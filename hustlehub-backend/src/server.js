require("dotenv").config({ quiet: true });

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const app = require("./app");
const connectDatabase = require("./config/database");
const { logEvent } = require("./config/logger");

async function disconnectAfterFailure() {
    try {
        await mongoose.disconnect();
    } catch {
        logEvent("error", "database.disconnect.failed", {
            reason: "disconnect_failed"
        });
    }
}

async function startServer() {
    const port = process.env.PORT || 5000;
    const httpsEnabled = process.env.HTTPS_ENABLED === "true";

    let stage = "database";

    try {
        await connectDatabase();

        let server;

        if (httpsEnabled) {
            stage = "https_configuration";

            if (
                !process.env.SSL_PFX_PATH ||
                !process.env.SSL_PFX_PASSPHRASE
            ) {
                throw new Error(
                    "HTTPS certificate configuration is missing."
                );
            }

            const certificatePath = path.resolve(
                __dirname,
                "..",
                process.env.SSL_PFX_PATH
            );

            server = https.createServer({
                pfx: fs.readFileSync(certificatePath),
                passphrase: process.env.SSL_PFX_PASSPHRASE
            }, app);
        } else {
            server = http.createServer(app);
        }

        stage = "listener";

        server.on("error", () => {
            logEvent("error", "server.error", {
                reason: "listen_failed"
            });

            process.exitCode = 1;

            void disconnectAfterFailure();
        });

        server.listen(port, () => {
            logEvent("info", "server.started", {
                outcome: httpsEnabled ? "https" : "http"
            });
        });

        return server;
    } catch {
        logEvent("error", "server.start.failed", {
            reason: `${stage}_failed`
        });

        process.exitCode = 1;

        await disconnectAfterFailure();

        return null;
    }
}

if (require.main === module) {
    startServer().catch(() => {
        logEvent("error", "server.start.failed", {
            reason: "unexpected_failure"
        });

        process.exitCode = 1;

        return disconnectAfterFailure();
    });
}

module.exports = { startServer };