import express from "express"
import Contact from "../model/contact.js"
import { config } from "../config/env.js"
import { asyncHandler } from "../middleware/asyncHandler.js"
import { strictLimiter } from '../utils/security.js';
import { isEmail } from '../utils/validate.js';


const routerContact = express.Router();

routerContact.post('/contact_us_request', strictLimiter, asyncHandler(async (req, res) => {
    const { fullName, email, phone, msg } = req.body;

    if(!fullName || typeof fullName !== 'string' || fullName.trim() === ''){
        return res.status(422).json({error:"Bad input: fullName is required"})
    }

    if(!email || typeof email !== 'string' || email.trim() === ''){
        return res.status(422).json({error:"Bad input: email is required"})
    }
    // Validate email format
    if(!isEmail(email)){
        return res.status(422).json({error:"Bad input: invalid email format"})
    }

    if(!phone || typeof phone !== 'string' || phone.trim() === ''){
        return res.status(422).json({error:"Bad input: phone is required"})
    }

    if(!msg || typeof msg !== 'string' || msg.trim() === ''){
        return res.status(422).json({error:"Bad input: message is required"})
    }

    const newContact = new Contact({
        fullName: fullName,
        email: email,
        phone: phone,
        msg: msg
    })

    await newContact.save();
    res.status(201).send("Created")
}))

export default routerContact;