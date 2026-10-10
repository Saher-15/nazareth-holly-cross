import express from "express"
import Order from "../model/order.js";
import { sendMail } from '../services/emailService.js';
import { createOrder as createPayPalOrder, captureOrder as capturePayPalOrder, getOrder as getPayPalOrder, assertPaid, verifiedCaptureStatus } from '../services/paypalService.js';
import { capturedPayment, linkPayment, paymentFor, recordCaptured, recordCreated, recordFailed } from '../services/payments.js';
import { priceFor, quoteShopOrder, quoteSignature, takeFromStock } from '../services/pricing.js';
import { invalidateCatalog } from '../services/catalog.js';
import Payment from '../model/payment.js';
import { fulfilCandle } from './candleRoute.js';
import { savedDraft, validateFulfilment } from '../services/checkoutDraft.js';
import { asyncHandler } from "../middleware/asyncHandler.js"
import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { orderNumber } from '../utils/orderNumber.js';
import { paymentLimiter, newOrderLimiter } from '../utils/security.js';
import { clip, isEmail, isPayPalOrderId } from '../utils/validate.js';


const routerOrder = express.Router();

const REQUIRED_ORDER_FIELDS = ['firstName', 'lastName', 'phone', 'email', 'street', 'city', 'state', 'postal', 'country'];

// A required text field of the request as trimmed text. Numbers are accepted (phone and postal codes are
// sometimes sent as numbers); objects, arrays, booleans and empty values are not.
const textField = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
};

export async function fulfilOrder(body = {}) {

    // The recipient saved with the payment wins over what this request carries (services/checkoutDraft.js).
    const details = (await savedDraft(body.paypalOrderId)) ?? body;
    const fields = {};
    for (const field of REQUIRED_ORDER_FIELDS) {
        fields[field] = textField(details[field]);
        if (fields[field] === undefined) {
            throw new HttpError(422, "Bad input");
        }
    }
    if (!isEmail(fields.email)) {
        throw new HttpError(422, 'Bad input');
    }
    if (!Array.isArray(body.products) || body.products.length === 0) {
        throw new HttpError(422, 'Bad input');
    }

    // The price comes from the product prices in the database, never from the browser.
    if (body.paypalOrderId && !isPayPalOrderId(body.paypalOrderId)) throw new HttpError(400, 'Invalid paypalOrderId');
    const payment = body.paypalOrderId ? await paymentFor(body.paypalOrderId, 'order') : null;
    const stored = payment?.orderQuote;
    if (stored?.lines?.length && quoteSignature(stored.lines) !== quoteSignature(body.products)) {
        throw new HttpError(409, 'Order items do not match the paid quote');
    }
    const { total: totalPrice, lines } = stored?.lines?.length
        ? { total: stored.amount, lines: stored.lines.map(line => ({ productID: line.productID, productName: line.productName, quantity: line.quantity, color: line.color ?? '' })) }
        : await quoteShopOrder(body.products); // in-flight pre-upgrade payments have no snapshot

    // Proof of payment is required by default and always in production. When supplied,
    // PayPal must confirm the order is COMPLETED and captured for exactly the price computed above, and one
    // PayPal order can pay for only one order.
    let paypalOrderId;
    if (body.paypalOrderId !== undefined && body.paypalOrderId !== null && body.paypalOrderId !== '') {
        if (!isPayPalOrderId(body.paypalOrderId)) {
            throw new HttpError(400, 'Invalid paypalOrderId');
        }
        if (await Order.exists({ paypalOrderId: body.paypalOrderId })) {
            throw new HttpError(409, 'This payment was already used for an order');
        }
        // The ledger knows what this payment was for: a $23 donation or a $3 candle cannot pay for an order.
        await assertPaid(body.paypalOrderId, totalPrice);
        paypalOrderId = body.paypalOrderId;
    } else if (config.requirePaymentProof) {
        throw new HttpError(402, 'Payment proof is required');
    } else {
        console.warn(`[${new Date().toISOString()}] [unverified-order] /order/newOrder without paypalOrderId (${totalPrice} USD): payment not checked`);
    }

    const order = await Order.create({
        ...fields,
        date: new Date(),
        totalPrice,
        products: lines,
        done: false,
        ...(paypalOrderId ? { paypalOrderId, paymentVerified: true } : {}),
    });

    // The units leave the stock once, with the order that was just saved (one PayPal payment saves one order: the
    // unique index on paypalOrderId). A failure here must not fail a paid order: it is logged for the owner.
    try {
        const { changed, oversold } = await takeFromStock(lines);
        if (changed) invalidateCatalog();
        for (const item of oversold) {
            console.error(`[${new Date().toISOString()}] [oversold] order ${order._id}: ${item.missing} more of "${item.productName}" (${item.productID}) sold than were in stock`);
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [stock] order ${order._id}: stock was not updated: ${error.message}`);
    }

    if (paypalOrderId) {
        await linkPayment(paypalOrderId, { kind: 'order', id: order._id, amount: totalPrice });
        // The order is already saved, so a mail failure must not fail the request; sendMail logs it. Only a PAID order
        // is confirmed by mail (security review 06, finding 5): an unpaid one (possible while REQUIRE_PAYMENT_PROOF is
        // off) must not make the church's Gmail write to an address a stranger typed. Plain text, server-made values only.
        sendMail({
            to: [fields.email],
            subject: 'We Got Your Order: Thanks for ordering',
            text: `Order number ${orderNumber(order._id)} (reference ${order._id}), we will let you know when your order ships :)`,
        });
    }
    return order;
}

routerOrder.post('/newOrder', newOrderLimiter, asyncHandler(async (req, res) => {
    await fulfilOrder(req.body);
    res.status(201).send('Created');
}));

routerOrder.post('/create_order', paymentLimiter, asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const quote = body.type === 'order' ? await quoteShopOrder(body.items) : null;
    const amount = quote ? quote.total : await priceFor(body);
    const fulfilment = body.fulfilment === undefined ? undefined : validateFulfilment(body.type, body.fulfilment);
    const order = await createPayPalOrder(amount);
    // The ledger row is written BEFORE the id reaches the browser, so every payment that can happen has a record
    // (model/payment.js). If it cannot be written the customer is told to try again and nothing was charged.
    await recordCreated({
        paypalOrderId: order.id,
        type: body.type ?? 'unknown',
        amount,
        orderQuote: quote ? { amount, lines: quote.lines } : undefined,
        fulfilment,
        donorName: body.type === 'donation' ? clip(body.donorName, 100) : undefined,
    });
    res.json({ id: order.id, status: order.status, amount });
}));

routerOrder.post('/complete_order', paymentLimiter, asyncHandler(async (req, res) => {
    const order_id = req.body?.order_id;
    if (!isPayPalOrderId(order_id)) {
        return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Idempotent: a second call (double click, a retry after a lost answer) never captures or records twice.
    if (await capturedPayment(order_id)) {
        await recoverFulfilment(order_id).catch(() => {});
        return res.json({ id: order_id, status: 'COMPLETED' });
    }

    // The server's own price for this payment, read BEFORE anything is captured: create_order writes it before the
    // PayPal id ever reaches a browser, so a PayPal order without one was not priced here and is never charged.
    const ledger = await Payment.findOne({ paypalOrderId: order_id });
    if (!(ledger?.amount > 0)) {
        return res.status(409).json({ error: 'No priced payment is recorded for this PayPal order' });
    }

    let capture;
    try {
        capture = await capturePayPalOrder(order_id);
    } catch (err) {
        if (err.upstreamStatus !== 422) throw err;
        // PayPal refuses to capture it again. Either it was already captured (the first answer never reached the
        // browser, or the ledger write failed) or the card was declined: ask PayPal which.
        const current = await getPayPalOrder(order_id).catch(() => null);
        if (!current) throw err; // PayPal could not even be asked: the outcome is unknown (502), the browser may ask again
        if (current.status !== 'COMPLETED') {
            // PayPal says it is not paid (a declined card): a definite answer, so the customer is told they were not charged
            await recordFailed(order_id, err.message);
            console.error(`[${new Date().toISOString()}] PayPal capture for ${order_id} was refused and the order is ${current.status}`);
            return res.status(402).json({ error: 'Payment was not completed', status: current.status });
        }
        capture = current;
    }
    const captureStatus = verifiedCaptureStatus(capture, ledger.amount);
    if (captureStatus === 'PENDING') {
        return res.status(202).json({ id: order_id, status: 'PENDING' });
    }
    if (captureStatus !== 'COMPLETED') {
        console.error(`[${new Date().toISOString()}] PayPal capture for ${order_id} ended as ${capture.status}`);
        await recordFailed(order_id, `capture ended as ${capture.status}`);
        return res.status(402).json({ error: 'Payment was not completed', status: capture.status });
    }
    // The money has moved. A ledger failure must not tell the customer the payment failed: log it loudly (the order
    // or candle request that follows links the payment again, and the reconciliation script finds the rest).
    try {
        await recordCaptured(order_id, capture);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] payment ledger: PayPal order ${order_id} was captured but not recorded: ${error.message}`);
    }
    // Payment success does not depend on immediate fulfilment: retained drafts are repairable.
    await recoverFulfilment(order_id).catch(() => {
        console.error(`[payment recovery] ${order_id}: fulfilment deferred; draft retained`);
    });
    res.json({ id: order_id, status: capture.status });
}));

// Reusable by capture retries and the bounded repair job; it never charges a payment.
export async function recoverFulfilment(paypalOrderId) {
    const payment = await Payment.findOne({ paypalOrderId }).select('+fulfilment');
    if (!payment?.captureVerified || !payment.fulfilment || payment.linkedTo?.id) return false;
    const body = { ...payment.fulfilment, paypalOrderId };
    try {
        if (payment.type === 'order') await fulfilOrder({ ...body, products: payment.orderQuote?.lines });
        else if (payment.type === 'candle') await fulfilCandle(body);
        else return false;
        return true;
    } catch (error) {
        // A previous save can have succeeded while its ledger link failed.
        const Model = payment.type === 'order' ? Order : (await import('../model/candle.js')).default;
        const existing = await Model.findOne({ paypalOrderId });
        if (!existing?.paymentVerified) throw error;
        await linkPayment(paypalOrderId, { kind: payment.type, id: existing._id, amount: payment.amount });
        return true;
    }
}

export default routerOrder;
