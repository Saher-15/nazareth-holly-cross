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

    // The phone number is optional (data minimisation, security review 06 finding 8): absent, null or empty means
    // "not given". When it is given it must be text; the model bounds it at 50 characters (a longer one is a 400).
    let phoneText = '';
    if (phone !== undefined && phone !== null && phone !== '') {
        if (typeof phone !== 'string') {
            return res.status(422).json({error:"Bad input: phone must be text"})
        }
        phoneText = phone.trim();
    }

    if(!msg || typeof msg !== 'string' || msg.trim() === ''){
        return res.status(422).json({error:"Bad input: message is required"})
    }

    const newContact = new Contact({
        fullName: fullName,
        email: email,
        phone: phoneText,
        msg: msg
    })

    await newContact.save();
    res.status(201).send("Created")
}))

export default routerContact;