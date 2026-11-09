
const mongoose = require("mongoose");

jest.mock("../src/models/Booking", () => ({
    create: jest.fn(),
    find: jest.fn(),
    deleteOne: jest.fn()
}));

jest.mock("../src/models/Transaction", () => ({
    create: jest.fn(),
    find: jest.fn(),
    aggregate: jest.fn()
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

const {
    getMyTransactions,
    getFreelancerIncome
} = require("../src/controllers/transactionController");

const CLIENT = "64b000000000000000000001";
const FREELANCER = "64b000000000000000000002";
const GIG_ID = "64c000000000000000000001";

function makeRequest(userId) {
    if (arguments.length === 0) {
        userId = CLIENT;
    }
    return {
        user: { userId },
        body: {
            gigId: GIG_ID,
            notes: "Normal booking notes"
        },
        params: {},
        query: {},
        logEvent: jest.fn()
    };
}

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

function mockGig(gig) {
    Gig.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(gig)
        })
    });
}

function mockQuery(result = []) {
    return {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(result)
    };
}

function expectNoDatabaseWrites() {
    expect(Booking.create).not.toHaveBeenCalled();
    expect(Transaction.create).not.toHaveBeenCalled();
}

function expectNoDatabaseReads() {
    expect(Gig.findById).not.toHaveBeenCalled();
    expect(Booking.find).not.toHaveBeenCalled();
    expect(Transaction.find).not.toHaveBeenCalled();
    expect(Transaction.aggregate).not.toHaveBeenCalled();
}

beforeEach(() => {
    jest.resetAllMocks();
});

describe("Booking security regression tests", () => {
    test.each([
        ["invalid"],
        ["123"],
        [""],
        [{ $ne: null }],
        [{ $gt: "" }],
        [{ $regex: ".*" }],
        [[GIG_ID]],
        [null]
    ])(
        "rejects invalid or injected gig ID: %p",
        async (invalidId) => {
            const req = makeRequest();
            const res = makeResponse();

            req.body.gigId = invalidId;

            await createBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Invalid gig ID."
            });

            expectNoDatabaseReads();
            expectNoDatabaseWrites();
        }
    );

    test.each([
        [{ $ne: null }],
        [{ $gt: "" }],
        [["64b000000000000000000001"]],
        ["invalid"],
        [null],
        [undefined]
    ])(
        "rejects invalid authenticated client ID: %p",
        async (invalidUserId) => {
            const req = makeRequest(invalidUserId);
            const res = makeResponse();

            await createBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expectNoDatabaseReads();
            expectNoDatabaseWrites();
        }
    );

    test.each([
        [{ $ne: null }],
        [["unexpected"]],
        [123],
        [true],
        ["x".repeat(2001)]
    ])(
        "rejects invalid booking notes: %p",
        async (invalidNotes) => {
            const req = makeRequest();
            const res = makeResponse();

            req.body.notes = invalidNotes;

            await createBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Invalid booking notes."
            });

            expectNoDatabaseReads();
            expectNoDatabaseWrites();
        }
    );

    test.each([
        ["getMyBookings", getMyBookings],
        ["getFreelancerBookings", getFreelancerBookings]
    ])(
        "%s rejects operator injection in authenticated user ID",
        async (name, handler) => {
            const req = makeRequest({ $ne: null });
            const res = makeResponse();

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(Booking.find).not.toHaveBeenCalled();
        }
    );

    test.each([
        [
            "client",
            getMyBookings,
            CLIENT,
            "clientId"
        ],
        [
            "freelancer",
            getFreelancerBookings,
            FREELANCER,
            "freelancerId"
        ]
    ])(
        "scopes valid %s booking queries to an ObjectId",
        async (role, handler, userId, field) => {
            Booking.find.mockReturnValue(mockQuery());

            const req = makeRequest(userId);
            const res = makeResponse();

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);

            expect(Booking.find).toHaveBeenCalledWith({
                [field]: new mongoose.Types.ObjectId(userId)
            });
        }
    );

    test("uses trusted gig values when creating bookings", async () => {
        mockGig({
            _id: GIG_ID,
            title: "Website Development",
            price: 850,
            freelancer: FREELANCER
        });

        Booking.create.mockResolvedValue({
            _id: "64d000000000000000000001",
            gigTitle: "Website Development",
            status: "confirmed",
            createdAt: new Date()
        });

        Transaction.create.mockResolvedValue({
            transactionId: "TXN-TEST",
            amount: 850,
            status: "completed"
        });

        const req = makeRequest();
        const res = makeResponse();

        req.body.price = 1;
        req.body.freelancerId = "attacker-controlled";

        await createBooking(req, res);

        expect(res.status).toHaveBeenCalledWith(201);

        expect(Gig.findById).toHaveBeenCalledWith(
            new mongoose.Types.ObjectId(GIG_ID)
        );

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
                status: "completed"
            })
        );
    });
});

describe("Transaction security regression tests", () => {
    test.each([
        [{ $ne: null }],
        [{ $gt: "" }],
        [["unexpected"]],
        ["invalid"],
        [null],
        [undefined]
    ])(
        "rejects invalid client IDs before transaction lookup: %p",
        async (invalidUserId) => {
            const req = makeRequest(invalidUserId);
            const res = makeResponse();

            await getMyTransactions(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(Transaction.find).not.toHaveBeenCalled();
        }
    );

    test.each([
        [{ $ne: null }],
        [{ $regex: ".*" }],
        [["unexpected"]],
        ["invalid"],
        [null],
        [undefined]
    ])(
        "rejects invalid freelancer IDs before income aggregation: %p",
        async (invalidUserId) => {
            const req = makeRequest(invalidUserId);
            const res = makeResponse();

            await getFreelancerIncome(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(Transaction.aggregate).not.toHaveBeenCalled();
            expect(Transaction.find).not.toHaveBeenCalled();
        }
    );

    test("scopes transaction history to the authenticated client", async () => {
        Transaction.find.mockReturnValue(mockQuery());

        const req = makeRequest();
        const res = makeResponse();

        req.query.clientId = FREELANCER;

        await getMyTransactions(req, res);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(Transaction.find).toHaveBeenCalledWith({
            clientId: new mongoose.Types.ObjectId(CLIENT)
        });
    });

    test("scopes income aggregation to the authenticated freelancer", async () => {
        Transaction.aggregate.mockResolvedValue([
            {
                totalIncome: 1200,
                completedBookings: 2
            }
        ]);

        Transaction.find.mockReturnValue(mockQuery());

        const req = makeRequest(FREELANCER);
        const res = makeResponse();

        await getFreelancerIncome(req, res);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(Transaction.aggregate).toHaveBeenCalledWith([
            {
                $match: {
                    freelancerId: new mongoose.Types.ObjectId(FREELANCER),
                    status: "completed"
                }
            },
            {
                $group: {
                    _id: null,
                    totalIncome: { $sum: "$amount" },
                    completedBookings: { $sum: 1 }
                }
            }
        ]);

        expect(Transaction.find).toHaveBeenCalledWith({
            freelancerId: new mongoose.Types.ObjectId(FREELANCER),
            status: "completed"
        });
    });
});
