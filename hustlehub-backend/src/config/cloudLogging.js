const { Logtail } = require("@logtail/node");
const { LogtailTransport } = require("@logtail/winston");

function createCloudLogging({
    env = process.env,
    reportFailure = () => {},
    createClient = (token, options) => new Logtail(token, options),
    createTransport = (client) => new LogtailTransport(client)
} = {}) {
    const disabled = {
        transport: null,
        flush: async () => {}
    };

    if (
        env.NODE_ENV === "test" ||
        env.BETTER_STACK_ENABLED !== "true"
    ) {
        return disabled;
    }

    let lastFailure = -Infinity;

    function notify(reason) {
        const now = Date.now();

        // Avoid flooding the terminal during a logging outage.
        if (now - lastFailure < 30000) return;

        lastFailure = now;

        try {
            reportFailure(reason);
        } catch {
            // Reporting a logging failure must also be safe.
        }
    }

    const token = String(
        env.BETTER_STACK_SOURCE_TOKEN || ""
    ).trim();

    let endpoint;

    try {
        const parsed = new URL(env.BETTER_STACK_INGESTING_URL);

        if (
            !token ||
            parsed.protocol !== "https:" ||
            parsed.username ||
            parsed.password ||
            parsed.search ||
            parsed.hash ||
            parsed.pathname !== "/"
        ) {
            throw new Error("Invalid cloud logging configuration.");
        }

        endpoint = parsed.toString();
    } catch {
        notify("cloud_configuration_invalid");
        return disabled;
    }

    try {
        const client = createClient(token, {
            endpoint,
            timeout: 3000,
            batchSize: 100,
            batchInterval: 1000,
            retryCount: 1,
            syncMax: 2,
            syncQueuedMax: 10,
            ignoreExceptions: false,
            throwExceptions: true,
            captureStackContext: false,
            contextObjectMaxDepthWarn: false,
            contextObjectCircularRefWarn: false,
            sendLogsToConsoleOutput: false
        });

        const send = client.log.bind(client);
        const flush = client.flush.bind(client);
        const pending = new Set();

        // Winston does not await delivery promises. Handle failures here
        // so a cloud outage cannot produce unhandled rejections.
        client.log = (...args) => {
            let operation;

            try {
                operation = send(...args);
            } catch {
                notify("cloud_delivery_failed");
                return Promise.resolve();
            }

            const completion = Promise.resolve(operation)
                .catch(() => {
                    notify("cloud_delivery_failed");
                })
                .finally(() => {
                    pending.delete(completion);
                });

            pending.add(completion);

            return completion;
        };

        client.flush = async () => {
            const outstanding = Array.from(pending);

            await Promise.resolve();

            try {
                await flush();
            } catch {
                notify("cloud_delivery_failed");
            }

            await Promise.all(outstanding);
        };

        return {
            transport: createTransport(client),
            flush: () => client.flush()
        };
    } catch {
        notify("cloud_initialization_failed");
        return disabled;
    }
}

module.exports = { createCloudLogging };