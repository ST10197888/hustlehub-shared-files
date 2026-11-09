const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");

require("dotenv").config({ quiet: true });

const registrationRouter = require("./routes/registration");
const loginRouter = require("./routes/login");
const logoutRouter = require("./routes/logout");
const protectedRouter = require("./routes/protected");
const gigRoutes = require("./routes/gigRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const financialRoutes = require("./routes/financialRoutes");

const { generalLimiter } = require("./middleware/rateLimiter");
const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Trust exactly one reverse proxy (the Nginx container). Do not expose the backend directly to untrusted clients while this configuration is enabled.
if (process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
}

const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";

// Run first so rejected requests and parsing errors have request IDs.
app.use(requestLogger);

app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "http://localhost:5000"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"]
        }
    },
    crossOriginResourcePolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: { maxAge: 31536000, includeSubDomains: true }
}));

app.use(generalLimiter);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || origin === clientOrigin) {
            return callback(null, true);
        }

        const error = new Error("Origin is not allowed by CORS.");
        error.name = "CorsOriginError";

        return callback(error);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-Request-ID"]
}));

app.use(express.json({ limit: "10kb" }));

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "HustleHub+ API Foundation is up and running."
    });
});

app.get("/health/live", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "hustlehub-backend"
    });
});

app.get("/health/ready", (req, res) => {
    const databaseConnected = mongoose.connection.readyState === 1;

    res.status(databaseConnected ? 200 : 503).json({
        status: databaseConnected ? "ready" : "not_ready",
        database: databaseConnected ? "connected" : "disconnected"
    });
});

app.use("/api/auth", registrationRouter);
app.use("/api/auth", loginRouter);
app.use("/api/auth", logoutRouter);

// Preserve the existing authentication route aliases.
app.use(registrationRouter);
app.use(loginRouter);
app.use(logoutRouter);

app.use(protectedRouter);
app.use("/api/gigs", gigRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/financial", financialRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found."
    });
});

app.use(errorHandler);

module.exports = app;