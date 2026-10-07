import express from "express"
import Candle from "../model/candle.js";
import { sendMail } from '../services/emailService.js';
import { assertPaid } from '../services/paypalService.js';
import { CANDLE_PRICE } from '../services/pricing.js';
import { linkPayment, paymentFor } from '../services/payments.js';
import { asyncHandler } from "../middleware/asyncHandler.js"
import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { strictLimiter } from '../utils/security.js';
import { isEmail, isPayPalOrderId } from '../utils/validate.js';


const routerCandle = express.Router();

routerCandle.post('/lightACandle', strictLimiter, asyncHandler(async(req, res)=>{
    const { firstName, lastName, email, prayer, paypalOrderId } = req.body;

    if(!firstName || typeof firstName !== 'string' || firstName.trim() === ''){
        return res.status(422).json({error:"Bad input: firstName is required"})
    }

    if(!lastName || typeof lastName !== 'string' || lastName.trim() === ''){
        return res.status(422).json({error:"Bad input: lastName is required"})
    }

    if(!email || typeof email !== 'string' || email.trim() === ''){
        return res.status(422).json({error:"Bad input: email is required"})
    }
    // Validate email format
    // Strict on purpose: this address is handed to the mailer, so "a@b.co,victim@x.com" must not pass.
    if(!isEmail(email)){
        return res.status(422).json({error:"Bad input: invalid email format"})
    }

    if(!prayer || typeof prayer !== 'string' || prayer.trim() === ''){
        return res.status(422).json({error:"Bad input: prayer is required"})
    }

    // Proof of payment. Optional for now (clients that do not send it yet keep working), like /order/newOrder:
    // when it is sent, the payment ledger (or PayPal itself) must confirm that PayPal captured the candle's price,
    // for a candle, and one payment lights one candle. REQUIRE_PAYMENT_PROOF=true makes it mandatory.
    let proven;
    if (paypalOrderId !== undefined && paypalOrderId !== null && paypalOrderId !== '') {
        if (!isPayPalOrderId(paypalOrderId)) {
            return res.status(400).json({ error: 'Invalid paypalOrderId' });
        }
        if (await Candle.exists({ paypalOrderId })) {
            throw new HttpError(409, 'This payment was already used for a candle');
        }
        await paymentFor(paypalOrderId, 'candle');
        // Always asked of PayPal, even when the ledger says "captured": a legacy create_order call without a type is
        // priced from the client, so only PayPal's own amount proves that the full candle price was paid.
        await assertPaid(paypalOrderId, CANDLE_PRICE);
        proven = paypalOrderId;
    } else if (config.requirePaymentProof) {
        throw new HttpError(402, 'Payment proof is required');
    } else {
        console.warn(`[${new Date().toISOString()}] [unverified-candle] /candle/lightACandle without paypalOrderId: payment not checked`);
    }

    const emailMsg = {
        to: [email.trim()],
        subject: 'We have received your request',
        text: `Dear ${firstName} ${lastName} ,\n\nA video with lighting a candle will be sent to your email \n\nBest regards,\nNazareth Holy Cross`
    };


    const newPrayer = new Candle({
        firstName: firstName,
        lastName: lastName,
        email: email,
        prayer: prayer,
        ...(proven ? { paypalOrderId: proven, paymentVerified: true } : {}),
    });

    await newPrayer.save();
    if (proven) await linkPayment(proven, { kind: 'candle', id: newPrayer._id, amount: CANDLE_PRICE });
    await sendMail(emailMsg);

    res.status(200).send("Success")
}))

export default routerCandle;
