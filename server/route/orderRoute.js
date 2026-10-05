import express from "express"
import Order from "../model/order.js";
import { sendMail } from '../services/emailService.js';
import { createOrder as createPayPalOrder, captureOrder as capturePayPalOrder, assertPaid } from '../services/paypalService.js';
import { priceFor, quoteShopOrder } from '../services/pricing.js';
import { requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from "../middleware/asyncHandler.js"
import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { paymentLimiter, newOrderLimiter } from '../utils/security.js';
import { isEmail, isPayPalOrderId } from '../utils/validate.js';


const routerOrder = express.Router();

routerOrder.get('/getAllOrders', requireAdmin, asyncHandler(async (req, res) => {
    const orders = await Order.find();
    res.status(200).send(orders);
}))

routerOrder.get('/getOrder/:id', requireAdmin, asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)

    if (!order) {
        return res.status(204).send("No Content");
    }

    res.status(200).send(order);
}))

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

    // The order is already saved, so a mail failure must not fail the request; sendMail logs it.
    sendMail({
        to: [fields.email],
        subject: 'We Got Your Order: Thanks for ordering',
        text: `Order number ${order._id}, we will let you know when your order ships :)`,
    });
    res.status(201).send("Created");
}))

routerOrder.patch('/orderSent/:id', requireAdmin, asyncHandler(async (req, res) => {
    const orderId = req.params.id;

    const updatedOrder = await Order.findByIdAndUpdate(orderId, { done: true }, { new: true });

    if (!updatedOrder) {
        return res.status(204).send("No Content");
    }

    const email = updatedOrder.email;

    const emailMsg = {
        to: [email],
        subject: 'Your order was shipped',
        text: `Your order number ${orderId} was shipped :)`,
    };

    if (!(await sendMail(emailMsg))) {
        return res.status(500).send("Error: Couldn't send email")
    }
    res.status(200).send("Success")
}))

routerOrder.delete('/deleteOrder/:id', requireAdmin, asyncHandler(async (req, res) => {
    await Order.findByIdAndDelete(req.params.id);
    res.status(200).send("Success");
}))

routerOrder.post('/create_order', paymentLimiter, asyncHandler(async (req, res) => {
    const amount = await priceFor(req.body ?? {});
    const order = await createPayPalOrder(amount);
    res.json({ id: order.id, status: order.status, amount });
}));

routerOrder.post('/complete_order', paymentLimiter, asyncHandler(async (req, res) => {
    const order_id = req.body?.order_id;
    if (!isPayPalOrderId(order_id)) {
        return res.status(400).json({ error: 'Invalid order ID' });
    }

    const capture = await capturePayPalOrder(order_id);
    if (capture.status !== 'COMPLETED') {
        console.error(`[${new Date().toISOString()}] PayPal capture for ${order_id} ended as ${capture.status}`);
        return res.status(402).json({ error: 'Payment was not completed', status: capture.status });
    }
    res.json({ id: capture.id, status: capture.status });
}));

export default routerOrder;
