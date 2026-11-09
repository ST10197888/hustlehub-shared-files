const {
    createCloudLogging
} = require("../src/config/cloudLogging");

function fixture(changes = {}) {
    const client = {
        log: jest.fn().mockResolvedValue(undefined),
        flush: jest.fn().mockResolvedValue(undefined)
    };

    const createClient = jest.fn().mockReturnValue(client);
    const createTransport = jest.fn().mockReturnValue({
        name: "test-transport"
    });
    const reportFailure = jest.fn();

    const options = {
        env: {
            NODE_ENV: "development",
            BETTER_STACK_ENABLED: "true",
            BETTER_STACK_SOURCE_TOKEN: "PRIVATE_SOURCE_TOKEN",
            BETTER_STACK_INGESTING_URL: "https://source.example.com",
            ...changes
        },
        createClient,
        createTransport,
        reportFailure
    };

    return {
        client,
        createClient,
        createTransport,
        reportFailure,
        options
    };
}

describe("Safe cloud logging connection", () => {
    test("keeps cloud logging optional", () => {
        const f = fixture({
            BETTER_STACK_ENABLED: "false"
        });

        expect(
            createCloudLogging(f.options).transport
        ).toBeNull();

        expect(f.createClient).not.toHaveBeenCalled();
    });

    test("never connects to the cloud in test mode", () => {
        const f = fixture({
            NODE_ENV: "test"
        });

        expect(
            createCloudLogging(f.options).transport
        ).toBeNull();

        expect(f.createClient).not.toHaveBeenCalled();
    });

    test("rejects missing tokens and unsafe endpoints without exposing credentials", () => {
        const invalidConfigurations = [
            {
                BETTER_STACK_SOURCE_TOKEN: ""
            },
            {
                BETTER_STACK_INGESTING_URL:
                    "http://source.example.com"
            },
            {
                BETTER_STACK_INGESTING_URL:
                    "https://user:PRIVATE_PASSWORD@source.example.com"
            },
            {
                BETTER_STACK_INGESTING_URL:
                    "https://source.example.com/?token=PRIVATE_TOKEN"
            }
        ];

        for (const change of invalidConfigurations) {
            const f = fixture(change);

            expect(
                createCloudLogging(f.options).transport
            ).toBeNull();

            expect(f.createClient).not.toHaveBeenCalled();

            expect(f.reportFailure).toHaveBeenCalledWith(
                "cloud_configuration_invalid"
            );

            expect(
                JSON.stringify(f.reportFailure.mock.calls)
            ).not.toMatch(/PRIVATE_/);
        }
    });

    test("uses bounded queues, timeouts and no automatic stack capture", () => {
        const f = fixture();
        const cloud = createCloudLogging(f.options);

        expect(cloud.transport).toEqual({
            name: "test-transport"
        });

        expect(f.createClient).toHaveBeenCalledWith(
            "PRIVATE_SOURCE_TOKEN",
            expect.objectContaining({
                endpoint: "https://source.example.com/",
                timeout: 3000,
                syncQueuedMax: 10,
                captureStackContext: false,
                throwExceptions: true
            })
        );
    });

    test("handles asynchronous delivery failures without rejected promises", async () => {
        const f = fixture();

        f.client.log.mockRejectedValue(
            new Error("PRIVATE_ERROR_DETAILS")
        );

        createCloudLogging(f.options);

        await expect(
            f.client.log("booking.created", "info", {})
        ).resolves.toBeUndefined();

        expect(f.reportFailure).toHaveBeenCalledWith(
            "cloud_delivery_failed"
        );

        expect(
            JSON.stringify(f.reportFailure.mock.calls)
        ).not.toMatch(/PRIVATE_/);
    });

    test("handles synchronous delivery failures", async () => {
        const f = fixture();

        f.client.log.mockImplementation(() => {
            throw new Error("PRIVATE_DETAILS");
        });

        createCloudLogging(f.options);

        await expect(
            f.client.log("booking.created", "info", {})
        ).resolves.toBeUndefined();

        expect(
            JSON.stringify(f.reportFailure.mock.calls)
        ).not.toMatch(/PRIVATE_/);
    });

    test("handles flush failures safely", async () => {
        const f = fixture();

        f.client.flush.mockRejectedValue(
            new Error("PRIVATE_DETAILS")
        );

        const cloud = createCloudLogging(f.options);

        await expect(
            cloud.flush()
        ).resolves.toBeUndefined();

        expect(f.reportFailure).toHaveBeenCalledWith(
            "cloud_delivery_failed"
        );
    });

    test("waits for pending log operations when flushing", async () => {
        const f = fixture();
        let finish;

        f.client.log.mockReturnValue(
            new Promise((resolve) => {
                finish = resolve;
            })
        );

        const cloud = createCloudLogging(f.options);

        f.client.log("booking.created", "info", {});

        let finished = false;

        const flushing = cloud.flush().then(() => {
            finished = true;
        });

        await Promise.resolve();
        await Promise.resolve();

        expect(finished).toBe(false);

        finish();
        await flushing;

        expect(finished).toBe(true);
    });
});