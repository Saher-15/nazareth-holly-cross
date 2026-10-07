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
import { greeting } from '../services/mailText.js';


const routerCandle = express.Router();

/** The "we received your candle request" mail: plain text, built from server-made values and a checked greeting. */
export function candleConfirmation({ email, firstName, candleId, paypalOrderId }) {
    return {
        to: [email],
        subject: 'We have received your candle request',
        text: [
            greeting(firstName),
            '',
            'Thank you: we have received your request to light a candle in Nazareth.',
            'A video of your candle being lit will be sent to this e-mail address.',
            '',
            `Your request number: ${candleId}`,
            `Your PayPal payment reference: ${paypalOrderId}`,
            '',
            'Best regards,',
            'Nazareth Holy Cross',
        ].join('\n'),
    };
}

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

    const newPrayer = new Candle({
        firstName: firstName,
        lastName: lastName,
        email: email,
        prayer: prayer,
        ...(proven ? { paypalOrderId: proven, paymentVerified: true } : {}),
    });

    await newPrayer.save();
    if (proven) {
        await linkPayment(proven, { kind: 'candle', id: newPrayer._id, amount: CANDLE_PRICE });
        // The confirmation goes out only for a PAID request (security review 06, finding 5): an unpaid request, possible
        // while REQUIRE_PAYMENT_PROOF is off, is saved for the staff to see but makes the church's Gmail send nothing
        // to an address a stranger typed. The mail is plain text and echoes no visitor text except a greeting name that
        // still looks like a name after cleaning (services/mailText.js); the prayer itself is never repeated.
        await sendMail(candleConfirmation({ email: email.trim(), firstName, candleId: newPrayer._id, paypalOrderId: proven }));
    } else {
        console.warn(`[${new Date().toISOString()}] [unverified-candle] candle ${newPrayer._id} saved without a payment: no confirmation mail sent`);
    }

    res.status(200).send("Success")
}))

export default routerCandle;
