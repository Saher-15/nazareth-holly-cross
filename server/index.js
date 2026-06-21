import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import dotenv from "dotenv"
import { xss } from "express-xss-sanitizer";
import routerOrder from "./route/orderRoute.js"
import routerProduct from "./route/productRoute.js"
import routerCandle from "./route/candleRoute.js"
import routerContact from "./route/contactRoute.js"
import routerLive from "./route/liveRoute.js";
import { globalLimiter } from "./utils/security.js";

dotenv.config()

if (process.env.ENVIRONMENT === 'sandbox') {
    import('morgan')
        .then((morgan) => {
            app.use(morgan.default('dev'));
        })
        .catch((err) => {
            console.error('Failed to load morgan:', err);
        });
}

const app = express()
app.set('trust proxy', 1);

mongoose.connect(process.env.DATABASEURL).then(() => console.log("DB connected")).catch((err) => console.log("DB Failed to Connect", err))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())
app.use(xss())
app.use(globalLimiter)


app.use("/product", routerProduct)
app.use("/order", routerOrder)
app.use("/candle", routerCandle)
app.use("/contact", routerContact)
app.use("/live", routerLive)

app.listen(process.env.PORT || 3000, () => console.log("server running on port 3000"))