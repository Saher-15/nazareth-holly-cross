import express from "express"
import Contact from "../model/contact.js"
import dotenv from "dotenv"
import { requireAdmin } from '../middleware/auth.js';

dotenv.config()

const routerContact = express.Router();

routerContact.post('/contact_us_request', async (req, res) => {
    try {
        const { fullName, email, phone, msg } = req.body;

        if(fullName === null || fullName === undefined || fullName === ""){
            return res.status(422).json({error:"Bad input"})
        }

        if(email === null || email === undefined || email === ""){
            return res.status(422).json({error:"Bad input"})
        }

        if(phone === null || phone === undefined || phone === ""){
            return res.status(422).json({error:"Bad input"})
        }

        if(msg === null || msg === undefined || msg === ""){
            return res.status(422).json({error:"Bad input"})
        }

        const newContact = new Contact({
            fullName: fullName,
            email: email,
            phone: phone,
            msg: msg
        })

        await newContact.save();
        res.status(201).send("Created")
    } catch (err) {
        res.status(500).json({ error: err })
    }
})

routerContact.get('/get_all_contact_us', requireAdmin, async (req, res) => {
    try {
        const requests = await Contact.find();

        if (!requests) {
            res.status(204).send("No Content")
        }

        res.status(200).send(requests)

    } catch (err) {
        res.status(500).json({ error: err })
    }
})

routerContact.get('/get_request/:id', requireAdmin, async (req, res) => {
    try {
        const request = await Contact.findById(req.params.id)

        if (!request) {
            return res.status(204).send("No Content");
        }

        res.status(200).send(request);
    } catch (err) {
        res.status(500).json({ error: err })
    }
})

routerContact.patch('/request_done/:id', requireAdmin, async (req, res) => {
    try {
        const requestId = req.params.id;

        const updatedRequest = await Contact.findByIdAndUpdate(requestId, { done: true }, { new: true });

        if (!updatedRequest) {
            return res.status(204).send("No Content");
        }

        res.status(200).send("Success")

    } catch (error) {
        res.status(500).json({ error: error })
    }
})

routerContact.delete('/delete_request/:id', requireAdmin, async (req, res) => {
    try {
        await Contact.findByIdAndDelete(req.params.id);
        res.status(200).send("Success");
    } catch (err) {
        res.status(500).send("Error")
    }
})

export default routerContact;