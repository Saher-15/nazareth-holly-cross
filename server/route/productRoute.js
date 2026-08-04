import express from "express"
import Product from "../model/product.js";
import { requireAdmin } from '../middleware/auth.js';

const routerProduct = express.Router();

routerProduct.get('/getAllProducts', async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).send(products);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' })
    }
})

routerProduct.get('/getNProducts', async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let size = parseInt(req.query.size) || 10;

        // Bounds-check to prevent DoS via extreme pagination values
        if (page < 1) page = 1;
        if (size < 1) size = 1;
        if (size > 100) size = 100; // cap at 100 items per page

        const skip = (page - 1) * size;

        const po = await Product.find().sort({ rate: -1 }).limit(size).skip(skip);
        const total_documents = await Product.countDocuments();

        const previous_pages = page - 1;
        const next_pages = Math.ceil((total_documents - skip) / size);

        return res.send({
            page: page,
            size: size,
            data: po,
            previous: previous_pages,
            next: next_pages
        })
    } catch (error) {
        return res.status(400).json({ error: 'Bad request' })
    }
})

routerProduct.get('/getProduct/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
        if (!product) {
            return res.status(404).send("Product not found");
        }
        res.status(200).send(product);
    } catch (err) {
        res.status(500).send("Error")
    }
})

routerProduct.delete('/deleteProduct/:id', requireAdmin, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.status(200).send("Success");
    } catch (err) {
        res.status(500).send("Error")
    }
})

routerProduct.post('/addProduct', requireAdmin, async (req, res) => {
    try {
        const { name, price, img, additionalImgsURL, description, uuidv4_ } = req.body;

        if (name === null || name === undefined || name === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (price === null || price === undefined || price === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (img === null || img === undefined || img === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (additionalImgsURL === null || additionalImgsURL === undefined || additionalImgsURL === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (description === null || description === undefined || description === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        if (uuidv4_ === null || uuidv4_ === undefined || uuidv4_ === "") {
            return res.status(422).json({ error: "Bad input" })
        }

        const newProduct = new Product({
            name: name,
            price: price,
            img: img,
            additionalImageUrls: additionalImgsURL,
            description: description,
            uuidv4_: uuidv4_
        });

        await newProduct.save();
        res.status(200).send("Success");
    } catch (error) {
        res.status(500).send("Error")
    }
})

routerProduct.put('/updateProduct/:id', requireAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, price, img, additionalImageUrls, description, uuidv4_ } = req.body;

        const existingProduct = await Product.findById(productId);

        if (!existingProduct) {
            return res.status(404).send("Error: Product not found")
        }

        if (name !== undefined) {
            existingProduct.name = name;
        }
        if (price !== undefined) {
            existingProduct.price = price;
        }

        if (img !== undefined) {
            existingProduct.img = img;
        }

        if (additionalImageUrls !== undefined) {
            existingProduct.additionalImageUrls = additionalImageUrls;
        }

        if (description !== undefined) {
            existingProduct.description = description;
        }

        if (uuidv4_ !== undefined) {
            existingProduct.uuidv4_ = uuidv4_;
        }

        const updatedProduct = await existingProduct.save()

        res.status(200).json(updatedProduct)
    } catch (error) {
        res.status(500).send("Error")
    }
})

export default routerProduct;