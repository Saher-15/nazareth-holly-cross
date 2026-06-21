import rateLimit from "express-rate-limit";

const globalLimiter = rateLimit({
    windowMs: 1000,
    limit: 5,
    handler: (req, res) => {
        return res.status(429).json({ error: 'Too many requests, please try again later.' });
    },
});

export { globalLimiter };