const { randomUUID } = require("node:crypto");
const { logEvent } = require("../config/logger");

function routeTemplate(req) {
    if (!req.route || typeof req.route.path !== "string") {
        return "unmatched";
    }

    return `${req.baseUrl || ""}${req.route.path}`;
}

function requestLogger(req, res, next) {
    const requestId = randomUUID();
    const startedAt = process.hrtime.bigint();

    req.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);

    req.logEvent = (level, event, details = {}) => {
        try {
            const context = {
                requestId,
                method: req.method,
                route: routeTemplate(req)
            };

            if (req.user && typeof req.user.userId === "string") {
                context.actorId = req.user.userId;
            }

            logEvent(level, event, { ...details, ...context });
        } catch {
            // Logging failures must not interrupt the request.
        }
    };

    const durationMs = () => {
        return Number(process.hrtime.bigint() - startedAt) / 1e6;
    };

    res.once("finish", () => {
        const statusCode = res.statusCode;

        const level = statusCode >= 500 ? "error" :
            statusCode >= 400 ? "warn" : "info";

        req.logEvent(level, "http.request.completed", {
            statusCode,
            durationMs: Math.round(durationMs() * 100) / 100
        });
    });

    res.once("close", () => {
        if (!res.writableFinished) {
            req.logEvent("warn", "http.request.aborted", {
                reason: "connection_closed",
                durationMs: Math.round(durationMs() * 100) / 100
            });
        }
    });

    next();
}

module.exports = requestLogger;