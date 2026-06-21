import mongoose from "mongoose";
const { Schema } = mongoose;

const orderSchema = new Schema({
    firstName: {
        type: String
    },
    lastName: {
        type: String
    },
    phone: {
        type: String
    },
    email: {
        type: String
    },
    date: {
        type: Date
    },
    street: {
        type: String
    },
    city: {
        type: String
    },
    state: {
        type: String
    },
    postal: {
        type: String
    },
    country: {
        type: String
    },
    totalPrice: {
        type: Number
    },
    products: [{
        productID: {
            type: mongoose.Types.ObjectId,
        },
        productName: {
            type: String
        },
        quantity: {
            type: Number
        },
        color: {
            type: String
        }
    }],
    done: {
        type: Boolean,
        default: false
    }
});

export default mongoose.model("Order", orderSchema, "order");