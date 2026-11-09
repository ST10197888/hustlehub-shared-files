const winston = require("winston");
const { createCloudLogging } = require("./cloudLogging");

const textFields = new Set([
    "requestId",
    "actorId",
    "bookingId",
    "transactionId",
    "method",
    "route",
    "reason",
    "errorType",
    "outcome"
]);

const numberFields = new Set([
    "statusCode",
    "durationMs",
    "retryAfterSeconds"
]);

function safeDetails(details) {
    const result = {};

    if (
        !details ||
        typeof details !== "object" ||
        Array.isArray(details)
    ) {
        return result;
    }

    for (const [key, value] of Object.entries(details)) {
        if (textFields.has(key) && typeof value === "string") {
            result[key] = value
                .slice(0, 160)
                .replace(/[\r\n\t]/g, " ");
        } else if (
            numberFields.has(key) &&
            typeof value === "number" &&
            Number.isFinite(value) &&
            value >= 0
        ) {
            result[key] = value;
        }
    }

    return result;
}

function reportLoggingFailure(reason = "transport_failed") {
    const allowedReasons = new Set([
        "transport_failed",
        "cloud_configuration_invalid",
        "cloud_initialization_failed",
        "cloud_delivery_failed"
    ]);

    // Transport errors may contain credentials or URLs.
    // Only write a fixed, safe reason.
    try {
        process.stderr.write(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "warn",
            service: "hustlehub-backend",
            event: "logging.failure",
            reason: allowedReasons.has(reason)
                ? reason
                : "transport_failed",
            message: "Logging destination failed."
        }) + "\n");
    } catch {
        // A broken logging destination must not interrupt the API.
    }
}

function createEventLogger(options = {}) {
    const cloud = options.transports
        ? null
        : createCloudLogging({
            reportFailure: reportLoggingFailure
        });

    const transports = options.transports || [
        new winston.transports.Console()
    ];

    if (cloud && cloud.transport) {
        transports.push(cloud.transport);
    }

    const core = winston.createLogger({
        level: "info",
        silent: options.silent === true,
        exitOnError: false,
        defaultMeta: {
            service: "hustlehub-backend"
        },
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        ),
        transports
    });

    core.on("error", reportLoggingFailure);

    function logEvent(level, event, details = {}) {
        try {
            if (
                !["info", "warn", "error"].includes(level) ||
                typeof event !== "string" ||
                !/^[a-z][a-z0-9_.]{0,79}$/.test(event)
            ) {
                return false;
            }

            core.log({
                ...safeDetails(details),
                level,
                event,
                message: event
            });

            return true;
        } catch {
            reportLoggingFailure();
            return false;
        }
    }

    function close() {
        try {
            core.close();
        } catch {
            reportLoggingFailure();
        }
    }

    return {
        logEvent,
        close,
        flush: cloud ? cloud.flush : async () => {}
    };
}

const defaultLogger = createEventLogger({
    silent: process.env.NODE_ENV === "test"
});

module.exports = {
    ...defaultLogger,
    createEventLogger
};