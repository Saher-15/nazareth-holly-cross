import express from "express"
import Order from "../model/order.js";
import { sendMail } from '../services/emailService.js';
import { createOrder as createPayPalOrder, captureOrder as capturePayPalOrder } from '../services/paypalService.js';
import { priceFor, priceShopOrder } from '../services/pricing.js';
import { requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from "../middleware/asyncHandler.js"


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

routerOrder.post('/newOrder', asyncHandler(async (req, res) => {
    const { products } = req.body;

    for (const field of REQUIRED_ORDER_FIELDS) {
        const value = req.body[field];
        if (value === null || value === undefined || value === "") {
            return res.status(422).json({ error: "Bad input" })
        }
    }
    if (!Array.isArray(products) || products.length === 0) {
        return res.status(422).json({ error: "Bad input" })
    }

    // The price comes from the product prices in the database, never from the browser.
    const totalPrice = await priceShopOrder(products);

    const { firstName, lastName, phone, email, street, city, state, postal, country } = req.body;
    const order = await Order.create({
        firstName, lastName, phone, email, street, city, state, postal, country,
        date: new Date(),
        totalPrice,
        products,
        done: false
    });

    // The order is already saved, so a mail failure must not fail the request; sendMail logs it.
    sendMail({
        to: [email],
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

routerOrder.post('/create_order', asyncHandler(async (req, res) => {
    const amount = await priceFor(req.body);
    const order = await createPayPalOrder(amount);
    res.json({ id: order.id, status: order.status, amount });
}));

routerOrder.post('/complete_order', asyncHandler(async (req, res) => {
    const order_id = req.body.order_id;
    if (!order_id || !/^[A-Z0-9]{17}$/.test(order_id)) {
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
