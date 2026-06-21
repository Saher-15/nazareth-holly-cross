import express from "express"
import Candle from "../model/candle.js";
import nodemailer from "nodemailer"
import dotenv from "dotenv"

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

const routerCandle = express.Router();

routerCandle.get('/getAllCandleRequests', async(req,res)=>{
    try{
        const requests = await Candle.find();
        res.status(200).send(requests);
    }catch(err){
        res.status(500).send("Error")
    }
})

routerCandle.put('/set_request_done/:id', async(req, res)=>{
    try{
        const requestId = req.params.id;
        const updateRequest = await Candle.findByIdAndUpdate(requestId, { done: true }, { new: true });

        if (!updateRequest) {
            return res.status(404).send("Request was not found");
        }

        res.status(200).send("Success")

    }catch(err){
        res.status(500).json({error: err})
    }
})

routerCandle.delete('/delete_lighting_request/:id', async(req, res)=>{
    try{
        await Candle.findByIdAndDelete(req.params.id);
        res.status(200).send("Success");
    }catch(err){
        res.status(500).send("Error")
    }
})

routerCandle.post('/lightACandle', async(req, res)=>{
    try{
        const { firstName, lastName, email, prayer } = req.body;

        if(firstName === null || firstName === undefined || firstName === ""){
            return res.status(422).json({error:"Bad input"})
        }

        if(lastName === null || lastName === undefined || lastName === ""){
            return res.status(422).json({error:"Bad input"})
        }

        if(email === null || email === undefined || email === ""){
            return res.status(422).json({error:"Bad input"})
        }

        if(prayer === null || prayer === undefined || prayer === ""){
            return res.status(422).json({error:"Bad input"})
        }

        const emailMsg = {
            to: [email],
            from: {
                name: "Nazareth Holy Cross",
                address: process.env.MAIL_FROM,
            },
            subject: 'We have received your request',
            text: `Dear ${firstName} ${lastName} ,\n\nA video with lighting a candle will be sent to your email \n\nBest regards,\nNazareth Holy Cross`
        };


        const newPrayer = new Candle({
            firstName: firstName,
            lastName: lastName,
            email: email,
            prayer: prayer
        });
        
        if(!SendMail(emailMsg)){
            return res.status(500).send("Error: Couldn't send email")
        }

        await newPrayer.save();

        res.status(200).send("Success")
    }catch(err){
        res.status(500).json({error:err})
    }
})

async function SendMail(msg){

    try{
        await transporter.sendMail(msg)
    }catch(err){
        console.log(err)
        return false;
    }

    return true;
}

export default routerCandle;