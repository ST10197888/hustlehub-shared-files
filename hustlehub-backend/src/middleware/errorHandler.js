function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        req.logEvent("error", "http.request.error", {
            reason: "response_already_started"
        });

        return next(err);
    }

    let statusCode = 500;
    let message = "Something went wrong on our end. Try again later";
    let reason = "internal_error";

    if (err.name === "CorsOriginError") {
        statusCode = 403;
        message = "Origin is not allowed by CORS.";
        reason = "cors_origin_denied";
    } else if (err.type === "entity.parse.failed") {
        statusCode = 400;
        message = "Request body must contain valid JSON.";
        reason = "invalid_json";
    } else if (err.type === "entity.too.large") {
        statusCode = 413;
        message = "Request body is too large.";
        reason = "body_too_large";
    }

    req.logEvent(
        statusCode >= 500 ? "error" : "warn",
        "http.request.error",
        { statusCode, reason }
    );

    return res.status(statusCode).json({
        success: false,
        message
    });
}

module.exports = errorHandler;