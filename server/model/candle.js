import mongoose from "mongoose";
const { Schema } = mongoose;

const candleSchema = new Schema({
    firstName:{
        type: String
    },
    lastName:{
        type: String
    },
    email:{
        type:String
    },
    prayer:{
        type:String
    },
    done:{
        type:Boolean,
        default: false
    }
});

export default mongoose.model("Candle", candleSchema, "candle");