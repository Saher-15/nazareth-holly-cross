import express from "express"
import Candle from "../model/candle.js";
import { sendMail } from '../services/emailService.js';
import { requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from "../middleware/asyncHandler.js"
import { strictLimiter } from '../utils/security.js';
import { isEmail } from '../utils/validate.js';


const routerCandle = express.Router();

routerCandle.get('/getAllCandleRequests', requireAdmin, asyncHandler(async(req,res)=>{
    const requests = await Candle.find();
    res.status(200).send(requests);
}))

routerCandle.put('/set_request_done/:id', requireAdmin, asyncHandler(async(req, res)=>{
    const requestId = req.params.id;
    const updateRequest = await Candle.findByIdAndUpdate(requestId, { done: true }, { new: true });

    if (!updateRequest) {
        return res.status(404).send("Request was not found");
    }

    res.status(200).send("Success")
}))

routerCandle.delete('/delete_lighting_request/:id', requireAdmin, asyncHandler(async(req, res)=>{
    await Candle.findByIdAndDelete(req.params.id);
    res.status(200).send("Success");
}))

routerCandle.post('/lightACandle', strictLimiter, asyncHandler(async(req, res)=>{
    const { firstName, lastName, email, prayer } = req.body;

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

    const emailMsg = {
        to: [email.trim()],
        subject: 'We have received your request',
        text: `Dear ${firstName} ${lastName} ,\n\nA video with lighting a candle will be sent to your email \n\nBest regards,\nNazareth Holy Cross`
    };


    const newPrayer = new Candle({
        firstName: firstName,
        lastName: lastName,
        email: email,
        prayer: prayer
    });

    await newPrayer.save();
    await sendMail(emailMsg);

    res.status(200).send("Success")
}))

export default routerCandle;