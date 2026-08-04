import express from "express"
import Order from "../model/order.js";
import nodemailer from "nodemailer"
import dotenv from "dotenv"
import { v4 as uuidv4 } from 'uuid';
import { requireAdmin } from '../middleware/auth.js';

dotenv.config()

const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Use `true` for port 465, `false` for all other ports
    auth: {
        user: process.env.MAIL_FROM,
        pass: process.env.MAIL_APP_PASSWORD,
    },
});

const environment = process.env.ENVIRONMENT || 'sandbox';
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const endpoint_url = environment === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

const routerOrder = express.Router();

routerOrder.get('/getAllOrders', requireAdmin, async (req, res) => {
    try {
        const orders = await Order.find();
        res.status(200).send(orders);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' })
    }
})

routerOrder.get('/getOrder/:id', requireAdmin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)

        if (!order) {
            return res.status(204).send("No Content");
        }

        res.status(200).send(order);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' })
    }
})

routerOrder.post('/newOrder', async (req, res) => {
    try {
        const { firstName, lastName, phone, email, street, city, state, postal, country, totalPrice, products } = req.body;

        if (firstName === null || firstName === undefined || firstName === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (lastName === null || lastName === undefined || lastName === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (email === null || email === undefined || email === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (phone === null || phone === undefined || phone === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (street === null || street === undefined || street === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (city === null || city === undefined || city === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (state === null || state === undefined || state === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (postal === null || postal === undefined || postal === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (country === null || country === undefined || country === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (totalPrice === null || totalPrice === undefined || totalPrice === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (products === null || products === undefined || products === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        const newOrder = new Order({
            firstName: firstName,
            lastName: lastName,
            phone: phone,
            email: email,
            date: new Date(),
            street: street,
            city: city,
            state: state,
            postal: postal,
            country: country,
            totalPrice: totalPrice,
            products: products,
            done: false
        });

        await newOrder.save().then(order => {
            const emailMsg = {
                to: [email],
                from: {
                    name: "Nazareth Holy Cross",
                    address: process.env.MAIL_FROM,
                },
                subject: 'We Got Your Order: Thanks for ordering',
                text: `Order number ${order._id}, we will let you know when your order ships :)`,
            };

            if (!SendMail(emailMsg)) {
                return res.status(500).send("Error: Couldn't send email")
            }
        });
        res.status(201).send("Created");

    } catch (error) {
        res.status(500).json({ error: 'Internal server error' })
    }
})

routerOrder.patch('/orderSent/:id', requireAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;

        const updatedOrder = await Order.findByIdAndUpdate(orderId, { done: true }, { new: true });

        if (!updatedOrder) {
            return res.status(204).send("No Content");
        }

        const order = await Order.findById(orderId);
        const email = order.email;

        const emailMsg = {
            to: [email],
            from: {
                name: "Nazareth Holy Cross",
                address: process.env.MAIL_FROM,
            },
            subject: 'Your order was shipped',
            text: `Your order number ${orderId} was shipped :)`,
        };

        if (!SendMail(emailMsg)) {
            return res.status(500).send("Error: Couldn't send email")
        }
        res.status(200).send("Success")

    } catch (error) {
        res.status(500).json({ error: 'Internal server error' })
    }
})

routerOrder.delete('/deleteOrder/:id', requireAdmin, async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        res.status(200).send("Success");
    } catch (err) {
        res.status(500).send("Error")
    }
})

async function SendMail(msg) {

    try {
        await transporter.sendMail(msg)
    } catch (err) {
        console.log(err)
        return false;
    }

    return true;
}

async function get_access_token() {
    const auth = `${client_id}:${client_secret}`
    const data = 'grant_type=client_credentials'
    const res = await fetch(endpoint_url + '/v1/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(auth).toString('base64')}`
        },
        body: data
    });
    const json = await res.json();
    return json.access_token;
}

routerOrder.post('/create_order', (req, res) => {
    const amount = parseFloat(req.body.amount);
    if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }
    const intent = 'CAPTURE';

    get_access_token()
        .then(access_token => {
            let order_data_json = {
                'intent': intent,
                'purchase_units': [{
                    'amount': {
                        'currency_code': 'USD',
                        'value': amount.toFixed(2)
                    }
                }]
            };
            const data = JSON.stringify(order_data_json)

            fetch(endpoint_url + '/v2/checkout/orders', { //https://developer.paypal.com/docs/api/orders/v2/#orders_create
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${access_token}`,
                    'PayPal-Request-Id': uuidv4()
                },
                body: data
            })
                .then(res => res.json())
                .then(json => {
                    res.send(json);
                }) //Send minimal data to client
        })
        .catch(err => {
            console.error(`[${new Date().toISOString()}] PayPal create_order error:`, err.message || err);
            res.status(500).json({ error: 'Payment processing error' });
        })
});

routerOrder.post('/complete_order', (req, res) => {
    const order_id = req.body.order_id;
    if (!order_id || !/^[A-Z0-9]{17}$/.test(order_id)) {
        return res.status(400).json({ error: 'Invalid order ID' });
    }

    get_access_token()
        .then(access_token => {
            fetch(endpoint_url + '/v2/checkout/orders/' + order_id + '/capture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${access_token}`,
                    'PayPal-Request-Id': uuidv4()
                }
            })
                .then(res => res.json())
                .then(json => {
                    res.send(json);
                }) //Send minimal data to client
        })
        .catch(err => {
            console.error(`[${new Date().toISOString()}] PayPal complete_order error:`, err.message || err);
            res.status(500).json({ error: 'Payment processing error' });
        })
});


export default routerOrder;