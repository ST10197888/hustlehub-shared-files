jest.mock("../src/models/Gig", () => {
    const Model = jest.fn();

    Model.find = jest.fn();
    Model.findById = jest.fn();
    Model.findByIdAndUpdate = jest.fn();
    Model.findByIdAndDelete = jest.fn();
    Model.findOneAndUpdate = jest.fn();
    Model.findOneAndDelete = jest.fn();

    return Model;
});

const Gig = require("../src/models/Gig");
const controller = require("../src/controllers/gigController");

const USER_ID = "64b000000000000000000001";
const OTHER_USER = "64b000000000000000000002";
const GIG_ID = "64c000000000000000000001";

function makeRequest() {
    return {
        user: { userId: USER_ID },
        params: { id: GIG_ID },
        body: {
            title: "PRIVATE_GIG_TITLE",
            price: 850
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

beforeEach(() => {
    jest.resetAllMocks();
});

describe("Safe gig errors and ownership denial logging", () => {
    const cases = [
        ["createGig", "creation_failed", () => {
            Gig.mockImplementation(() => ({
                save: jest.fn().mockRejectedValue(
                    new Error("PRIVATE_DATABASE_ERROR")
                )
            }));
        }],

        ["getAllGigs", "listing_failed", () => {
            Gig.find.mockReturnValue({
                populate: jest.fn().mockRejectedValue(
                    new Error("PRIVATE_DATABASE_ERROR")
                )
            });
        }],

        ["getGigById", "lookup_failed", () => {
            Gig.findById.mockReturnValue({
                populate: jest.fn().mockRejectedValue(
                    new Error("PRIVATE_DATABASE_ERROR")
                )
            });
        }],

        ["getMyGigs", "owned_listing_failed", () => {
            Gig.find.mockRejectedValue(
                new Error("PRIVATE_DATABASE_ERROR")
            );
        }],

        ["updateGig", "update_failed", () => {
            Gig.findById.mockRejectedValue(
                new Error("PRIVATE_DATABASE_ERROR")
            );
        }],

        ["deleteGig", "deletion_failed", () => {
            Gig.findById.mockRejectedValue(
                new Error("PRIVATE_DATABASE_ERROR")
            );
        }]
    ];

    test.each(cases)(
        "%s hides raw errors and records a safe reason",
        async (name, reason, configure) => {
            configure();

            const req = makeRequest();
            const res = makeResponse();

            await controller[name](req, res);

            expect(res.status).toHaveBeenCalledWith(500);

            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Unable to process the gig request. Try again later."
            });

            expect(req.logEvent).toHaveBeenCalledWith(
                "error",
                "gig.operation.failed",
                { reason }
            );

            expect(JSON.stringify([
                req.logEvent.mock.calls,
                res.json.mock.calls
            ])).not.toMatch(/PRIVATE_/);
        }
    );

    test.each([
        ["updateGig", "gig_update_ownership_required", "findOneAndUpdate"],
        ["deleteGig", "gig_delete_ownership_required", "findOneAndDelete"]
    ])(
        "%s denies changes to another freelancer's gig",
        async (name, reason, writeMethod) => {
            Gig.findById.mockResolvedValue({
                freelancer: OTHER_USER
            });

            const req = makeRequest();
            const res = makeResponse();

            await controller[name](req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(Gig[writeMethod]).not.toHaveBeenCalled();

            expect(req.logEvent).toHaveBeenCalledWith(
                "warn",
                "authorization.denied",
                { reason }
            );
        }
    );
});