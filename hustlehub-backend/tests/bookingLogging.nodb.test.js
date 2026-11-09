const mongoose = require("mongoose");

jest.mock("../src/models/Booking", () => ({
    create: jest.fn(),
    deleteOne: jest.fn(),
    find: jest.fn()
}));

jest.mock("../src/models/Transaction", () => ({
    create: jest.fn()
}));

jest.mock("../src/models/Gig", () => ({
    findById: jest.fn()
}));

const Booking = require("../src/models/Booking");
const Transaction = require("../src/models/Transaction");
const Gig = require("../src/models/Gig");

const {
    createBooking,
    getMyBookings,
    getFreelancerBookings
} = require("../src/controllers/bookingController");

const CLIENT = "64b000000000000000000001";
const FREELANCER = "64b000000000000000000002";
const GIG = "64c000000000000000000001";
const BOOKING = "64d000000000000000000001";

function makeRequest(userId = CLIENT) {
    return {
        user: { userId },
        body: {
            gigId: GIG,
            notes: "PRIVATE_BOOKING_NOTES"
        },
        logEvent: jest.fn()
    };
}

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

function mockGig(value) {
    Gig.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(value)
        })
    });
}

function expectNoPrivateData(req, res) {
    expect(JSON.stringify([
        req.logEvent.mock.calls,
        res.json.mock.calls
    ])).not.toMatch(/PRIVATE_/);
}

beforeEach(() => {
    jest.resetAllMocks();

    mockGig({
        _id: GIG,
        title: "Website",
        price: 850,
        freelancer: FREELANCER
    });

    Booking.create.mockResolvedValue({
        _id: BOOKING,
        gigTitle: "Website",
        status: "confirmed",
        createdAt: new Date("2026-11-08T12:00:00Z")
    });

    Booking.deleteOne.mockResolvedValue({
        deletedCount: 1
    });

    Transaction.create.mockResolvedValue({
        transactionId: "TXN-EXAMPLE",
        amount: 850,
        status: "completed"
    });
});

describe("Booking and transaction event logging", () => {
    test("logs both persisted records and uses database price and freelancer", async () => {
        const req = makeRequest();
        const res = makeResponse();

        req.body.price = 1;
        req.body.freelancerId = "attacker-controlled";

        await createBooking(req, res);

        expect(res.status).toHaveBeenCalledWith(201);

        expect(Booking.create).toHaveBeenCalledWith(
            expect.objectContaining({
                clientId: new mongoose.Types.ObjectId(CLIENT),
                freelancerId: FREELANCER,
                price: 850
            })
        );

        expect(Transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
            clientId: new mongoose.Types.ObjectId(CLIENT),
            freelancerId: FREELANCER,
            amount: 850,
            transactionId: expect.stringMatching(/^TXN-[A-F0-9]{12}$/)
            })
        );

        expect(req.logEvent).toHaveBeenCalledWith(
            "info",
            "transaction.recorded",
            {
                bookingId: BOOKING,
                transactionId: "TXN-EXAMPLE",
                outcome: "completed"
            }
        );

        expect(req.logEvent).toHaveBeenCalledWith(
            "info",
            "booking.created",
            {
                bookingId: BOOKING,
                transactionId: "TXN-EXAMPLE"
            }
        );

        expect(Booking.deleteOne).not.toHaveBeenCalled();
        expectNoPrivateData(req, res);
    });

    test("keeps persisted records when response generation fails", async () => {
        const req = makeRequest();
        const res = makeResponse();

        res.json.mockImplementationOnce(() => {
            throw new Error("PRIVATE_RESPONSE_ERROR");
        });

        await createBooking(req, res);

        expect(Booking.deleteOne).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenLastCalledWith(500);

        expect(req.logEvent).toHaveBeenCalledWith(
            "error",
            "booking.create.failed",
            { reason: "response_failed" }
        );

        expectNoPrivateData(req, res);
    });

    test("records missing gigs without creating either record", async () => {
        mockGig(null);

        const req = makeRequest();
        const res = makeResponse();

        await createBooking(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(Booking.create).not.toHaveBeenCalled();
        expect(Transaction.create).not.toHaveBeenCalled();

        expect(req.logEvent).toHaveBeenCalledWith(
            "warn",
            "booking.rejected",
            { reason: "gig_not_found" }
        );
    });

    test("records gig lookup failures without raw exception details", async () => {
        Gig.findById.mockImplementation(() => {
            throw new Error("PRIVATE_CONNECTION");
        });

        const req = makeRequest();
        const res = makeResponse();

        await createBooking(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(req.logEvent).toHaveBeenCalledWith(
            "error",
            "booking.create.failed",
            { reason: "gig_lookup_failed" }
        );

        expectNoPrivateData(req, res);
    });

    test("does not record a transaction when booking creation fails", async () => {
        Booking.create.mockRejectedValue(
            new Error("PRIVATE_DATABASE")
        );

        const req = makeRequest();
        const res = makeResponse();

        await createBooking(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(Transaction.create).not.toHaveBeenCalled();
        expect(Booking.deleteOne).not.toHaveBeenCalled();

        expect(req.logEvent).toHaveBeenCalledWith(
            "error",
            "booking.create.failed",
            { reason: "booking_creation_failed" }
        );

        expectNoPrivateData(req, res);
    });

    test("records transaction failure and booking cleanup without success events", async () => {
        Transaction.create.mockRejectedValue(
            new Error("PRIVATE_TRANSACTION")
        );

        const req = makeRequest();
        const res = makeResponse();

        await createBooking(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(Booking.deleteOne).toHaveBeenCalledWith({
            _id: BOOKING
        });

        expect(req.logEvent).toHaveBeenCalledWith(
            "error",
            "transaction.recording.failed",
            {
                bookingId: BOOKING,
                reason: "recording_failed"
            }
        );

        expect(req.logEvent).toHaveBeenCalledWith(
            "warn",
            "booking.cleanup.completed",
            {
                bookingId: BOOKING,
                reason: "transaction_not_recorded"
            }
        );

        expect(
            req.logEvent.mock.calls.some(([level]) => level === "info")
        ).toBe(false);

        expectNoPrivateData(req, res);
    });

    test("records cleanup failures while preserving a safe error response", async () => {
        Transaction.create.mockRejectedValue(
            new Error("PRIVATE_TRANSACTION")
        );

        Booking.deleteOne.mockRejectedValue(
            new Error("PRIVATE_CLEANUP")
        );

        const req = makeRequest();
        const res = makeResponse();

        await createBooking(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(req.logEvent).toHaveBeenCalledWith(
            "error",
            "booking.cleanup.failed",
            {
                bookingId: BOOKING,
                reason: "cleanup_failed"
            }
        );

        expectNoPrivateData(req, res);
    });

    test.each([
        ["client", getMyBookings, CLIENT, "clientId"],
        ["freelancer", getFreelancerBookings, FREELANCER, "freelancerId"]
    ])(
        "keeps %s booking queries scoped to the authenticated account",
        async (role, handler, userId, field) => {
            Booking.find.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([])
                    })
                })
            });

            const req = makeRequest(userId);
            const res = makeResponse();

            await handler(req, res);

            expect(Booking.find).toHaveBeenCalledWith({
                [field]: new mongoose.Types.ObjectId(userId)
            });

            expect(res.status).toHaveBeenCalledWith(200);

            expect(req.logEvent).toHaveBeenCalledWith(
                "info",
                "booking.list.viewed"
            );
        }
    );

    test("records booking list failures without raw exception details", async () => {
        Booking.find.mockImplementation(() => {
            throw new Error("PRIVATE_DATABASE");
        });

        const req = makeRequest();
        const res = makeResponse();

        await getMyBookings(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(req.logEvent).toHaveBeenCalledWith(
            "error",
            "booking.list.failed",
            { reason: "lookup_failed" }
        );

        expectNoPrivateData(req, res);
    });
});