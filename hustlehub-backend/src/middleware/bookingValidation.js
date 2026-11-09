const { body, validationResult } = require("express-validator");

const allowedFields = ["gigId", "notes"];

function hasOnlyAllowedFields(value) {
    return Object.keys(value).every((key) => allowedFields.includes(key));
}

const bookingRules = [
    body()
        .isObject()
        .withMessage("Request body must be a JSON object.")
        .bail()
        .custom(hasOnlyAllowedFields)
        .withMessage("Request contains unsupported fields."),
    body("gigId")
        .isString()
        .withMessage("Gig ID must be text.")
        .bail()
        .trim()
        .notEmpty()
        .withMessage("Gig ID is required.")
        .bail()
        .isMongoId()
        .withMessage("Gig ID is invalid."),
    body("notes")
        .optional()
        .isString()
        .withMessage("Notes must be text.")
        .bail()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Notes are too long.")
        .bail()
        .escape()
];

function validateBooking(req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    return next();
}

module.exports = { bookingRules, validateBooking };
