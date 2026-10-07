import express from "express"
import Order from "../model/order.js";
import { sendMail } from '../services/emailService.js';
import { createOrder as createPayPalOrder, captureOrder as capturePayPalOrder, getOrder as getPayPalOrder, assertPaid } from '../services/paypalService.js';
import { capturedPayment, linkPayment, paymentFor, recordCaptured, recordCreated, recordFailed } from '../services/payments.js';
import { priceFor, quoteShopOrder } from '../services/pricing.js';
import { asyncHandler } from "../middleware/asyncHandler.js"
import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
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

routerOrder.post('/newOrder', newOrderLimiter, asyncHandler(async (req, res) => {
    const body = req.body ?? {};

    const fields = {};
    for (const field of REQUIRED_ORDER_FIELDS) {
        fields[field] = textField(body[field]);
        if (fields[field] === undefined) {
            return res.status(422).json({ error: "Bad input" })
        }
    }
    if (!isEmail(fields.email)) {
        return res.status(422).json({ error: "Bad input" })
    }
    if (!Array.isArray(body.products) || body.products.length === 0) {
        return res.status(422).json({ error: "Bad input" })
    }

    // The price comes from the product prices in the database, never from the browser.
    const { total: totalPrice, lines } = await quoteShopOrder(body.products);

    // Proof of payment. Optional for now so clients that do not send it yet keep working: when it is sent,
    // PayPal must confirm the order is COMPLETED and captured for exactly the price computed above, and one
    // PayPal order can pay for only one order.
    let paypalOrderId;
    if (body.paypalOrderId !== undefined && body.paypalOrderId !== null && body.paypalOrderId !== '') {
        if (!isPayPalOrderId(body.paypalOrderId)) {
            return res.status(400).json({ error: 'Invalid paypalOrderId' });
        }
        if (await Order.exists({ paypalOrderId: body.paypalOrderId })) {
            throw new HttpError(409, 'This payment was already used for an order');
        }
        // The ledger knows what this payment was for: a $23 donation or a $3 candle cannot pay for an order.
        await paymentFor(body.paypalOrderId, 'order');
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

    if (paypalOrderId) {
        await linkPayment(paypalOrderId, { kind: 'order', id: order._id, amount: totalPrice });
        // The order is already saved, so a mail failure must not fail the request; sendMail logs it. Only a PAID order
        // is confirmed by mail (security review 06, finding 5): an unpaid one (possible while REQUIRE_PAYMENT_PROOF is
        // off) must not make the church's Gmail write to an address a stranger typed. Plain text, server-made values only.
        sendMail({
            to: [fields.email],
            subject: 'We Got Your Order: Thanks for ordering',
            text: `Order number ${order._id}, we will let you know when your order ships :)`,
        });
    }
    res.status(201).send("Created");
}))

routerOrder.post('/create_order', paymentLimiter, asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const amount = await priceFor(body);
    const order = await createPayPalOrder(amount);
    // The ledger row is written BEFORE the id reaches the browser, so every payment that can happen has a record
    // (model/payment.js). If it cannot be written the customer is told to try again and nothing was charged.
    await recordCreated({
        paypalOrderId: order.id,
        type: body.type ?? 'unknown',
        amount,
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
    if (await capturedPayment(order_id)) return res.json({ id: order_id, status: 'COMPLETED' });

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
    if (capture.status !== 'COMPLETED') {
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
    res.json({ id: order_id, status: capture.status });
}));

export default routerOrder;
