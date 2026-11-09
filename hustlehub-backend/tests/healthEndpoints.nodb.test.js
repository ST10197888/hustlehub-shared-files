
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");

describe("Backend health endpoints", () => {
    test("GET /health/live returns HTTP 200", async () => {
        const response = await request(app).get("/health/live");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            status: "ok",
            service: "hustlehub-backend"
        });
    });

    test("GET /health/ready returns 503 when MongoDB is disconnected", async () => {
        const response = await request(app).get("/health/ready");

        expect(response.status).toBe(503);
        expect(response.body).toEqual({
            status: "not_ready",
            database: "disconnected"
        });
    });

    test("GET /health/ready returns 200 when MongoDB is connected", async () => {
        const originalReadyState = Object.getOwnPropertyDescriptor(
            mongoose.connection,
            "readyState"
        );

        try {
            Object.defineProperty(mongoose.connection, "readyState", {
                configurable: true,
                value: 1
            });

            const response = await request(app).get("/health/ready");

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                status: "ready",
                database: "connected"
            });
        } finally {
            if (originalReadyState) {
                Object.defineProperty(
                    mongoose.connection,
                    "readyState",
                    originalReadyState
                );
            } else {
                delete mongoose.connection.readyState;
            }
        }
    });
});
