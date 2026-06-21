import mongoose from "mongoose";
const { Schema } = mongoose;

const contactSchema = new Schema({
    fullName:{
        type: String
    },
    email:{
        type:String
    },
    phone:{
        type:String
    },
    msg:{
        type:String
    },
    done:{
        type:Boolean,
        default: false
    }
});

export default mongoose.model("Contact", contactSchema, "contact");