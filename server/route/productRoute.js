import express from "express"
import Product from "../model/product.js";
import { asyncHandler } from "../middleware/asyncHandler.js"
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import ProductReview from '../model/productReview.js';
import { config } from '../config/env.js';
import { strictLimiter } from '../utils/security.js';
import { HttpError } from '../utils/httpError.js';
import { LEGACY_LIST_CAP, sendCapped } from '../utils/pagination.js';
import { categoryCounts, getCatalog, invalidateCatalog, rankBestSellers, rankSimilar } from '../services/catalog.js';

const routerProduct = express.Router();

// Any successful change to products refreshes the storefront catalog.
routerProduct.use((req, res, next) => {
    if (req.method !== 'GET') res.on('finish', () => res.statusCode < 400 && invalidateCatalog());
    next();
});

routerProduct.get('/getAllProducts', asyncHandler(async (req, res) => {
    // Newest first and capped (docs/DATABASE.md). The storefront reads /product/catalog; this is the old list.
    const products = await Product.find().sort({ createdAt: -1 }).limit(LEGACY_LIST_CAP).lean();
    sendCapped(res, products);
}))

routerProduct.get('/getNProducts', asyncHandler(async (req, res) => {
    let page = parseInt(req.query.page) || 1;
    let size = parseInt(req.query.size) || 10;

    // Bounds-check to prevent DoS via extreme pagination values
    if (page < 1) page = 1;
    if (size < 1) size = 1;
    if (size > 100) size = 100; // cap at 100 items per page

    const skip = (page - 1) * size;

    const po = await Product.find().sort({ rate: -1, _id: 1 }).limit(size).skip(skip).lean();
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
}))

routerProduct.get('/getProduct/:id', asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id)
    if (!product) {
        return res.status(404).send("Product not found");
    }
    res.status(200).send(product);
}))

// ---------------------------------------------------------------------------------------------
// Storefront data: catalog with categories, best sellers, similar products and product reviews.
// ---------------------------------------------------------------------------------------------

const clampLimit = (value, fallback, max) => {
    const n = parseInt(value, 10);
    return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
};

const findInCatalog = async (id) => {
    if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Invalid id');
    const products = await getCatalog();
    const product = products.find((p) => p._id === String(id));
    if (!product) throw new HttpError(404, 'Product not found');
    return { products, product };
};

// Every product with category, materials, units sold and rating, plus category counts.
routerProduct.get('/catalog', asyncHandler(async (req, res) => {
    const products = await getCatalog();
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ categories: categoryCounts(products), products });
}))

routerProduct.get('/bestSellers', asyncHandler(async (req, res) => {
    const products = await getCatalog();
    res.set('Cache-Control', 'public, max-age=60');
    res.json(rankBestSellers(products, clampLimit(req.query.limit, 8, 24)));
}))

routerProduct.get('/:id/similar', asyncHandler(async (req, res) => {
    const { products, product } = await findInCatalog(req.params.id);
    res.set('Cache-Control', 'public, max-age=60');
    res.json(rankSimilar(products, product, clampLimit(req.query.limit, 4, 12)));
}))

routerProduct.get('/:id/reviews', asyncHandler(async (req, res) => {
    const { product } = await findInCatalog(req.params.id);
    const reviews = await ProductReview.find({ product: product._id, approved: true })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('name country rating title comment createdAt')
        .lean();
    // Counted over ALL approved reviews, like the average and the total next to it (the list above is the newest 50).
    const counts = await Promise.all([1, 2, 3, 4, 5].map((rating) => ProductReview.countDocuments({ product: product._id, approved: true, rating })));
    const distribution = { 1: counts[0], 2: counts[1], 3: counts[2], 4: counts[3], 5: counts[4] };
    res.json({ summary: { ...product.rating, distribution }, reviews });
}))

const REVIEW_FIELDS = { name: [2, 80], country: [0, 80], title: [0, 120], comment: [3, 1000] };

routerProduct.post('/:id/reviews', strictLimiter, asyncHandler(async (req, res) => {
    const { product } = await findInCatalog(req.params.id);
    const body = req.body || {};

    // Honeypot: a hidden field real visitors never fill in. Answer as if it worked.
    if (body.website) return res.status(201).json({ ok: true });

    const clean = {};
    for (const [field, [min, max]] of Object.entries(REVIEW_FIELDS)) {
        const value = typeof body[field] === 'string' ? body[field].trim() : '';
        if (value.length < min || value.length > max) {
            return res.status(422).json({ error: `Invalid ${field}` });
        }
        clean[field] = value;
    }
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(422).json({ error: 'Invalid rating' });
    }

    const ipHash = crypto.createHash('sha256').update(`${req.ip}|${config.jwtSecret}`).digest('hex');
    const review = await ProductReview.create({ product: product._id, rating, ipHash, ...clean });
    invalidateCatalog();
    res.status(201).json({
        _id: review._id,
        name: review.name,
        country: review.country,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        createdAt: review.createdAt,
    });
}))

export default routerProduct;