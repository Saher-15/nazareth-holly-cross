import mongoose from "mongoose";
const { Schema } = mongoose;

const productSchema = new Schema({
    name: {
        type: String
    },
    price: {
        type: Number
    },
    img: {
        type: String
    },
    additionalImageUrls: [{
        type: String
    }],
    description: {
        type: String
    },
    uuidv4_: {
        type: String
    },
    rate: {
        type: Number,
        default: 1
    },
    color: [{
        type: String,
        default: null
    }]
});

export default mongoose.model("Product", productSchema, "product");