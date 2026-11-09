const { body, param, validationResult } = require('express-validator');

const allowedFields = ['title', 'description', 'category', 'price'];

const gigBodyRules = [
    body().isObject().withMessage('Request body must be a JSON object.')
        .bail()
        .custom((value) =>
            Object.keys(value).every((key) => allowedFields.includes(key))
        )
        .withMessage('Request contains unsupported fields.'),
    body('title').isString().withMessage('Title must be text.')
        .bail().trim().notEmpty().withMessage('Title is required.')
        .bail().isLength({ max: 120 }).withMessage('Title is too long.')
        .bail().escape(),
    body('description').isString().withMessage('Description must be text.')
        .bail().trim().notEmpty().withMessage('Description is required.')
        .bail().isLength({ max: 5000 }).withMessage('Description is too long.')
        .bail().escape(),
    body('category').isString().withMessage('Category must be text.')
        .bail().trim().notEmpty().withMessage('Category is required.')
        .bail().isLength({ max: 80 }).withMessage('Category is too long.')
        .bail().escape(),
    body('price').isFloat({ min: 0 })
        .withMessage('Price must be a non-negative number.')
        .bail().toFloat()
];

const createGigRules = [...gigBodyRules];

const updateGigRules = [
    param('id').isMongoId().withMessage('Gig ID is invalid.'),
    ...gigBodyRules
];

function validateGigInput(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    return next();
}

module.exports = { createGigRules, updateGigRules, validateGigInput };