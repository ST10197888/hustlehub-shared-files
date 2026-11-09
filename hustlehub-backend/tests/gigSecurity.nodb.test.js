
const mongoose = require("mongoose");

jest.mock("../src/models/Gig", () => {
    const Model = jest.fn();

    Model.find = jest.fn();
    Model.findById = jest.fn();
    Model.findOneAndUpdate = jest.fn();
    Model.findOneAndDelete = jest.fn();

    return Model;
});

const Gig = require("../src/models/Gig");
const {
    createGig,
    getGigById,
    getMyGigs,
    updateGig,
    deleteGig
} = require("../src/controllers/gigController");

const OWNER = "64b000000000000000000001";
const OTHER_USER = "64b000000000000000000002";
const GIG_ID = "64c000000000000000000001";

function makeRequest() {
    return {
        user: { userId: OWNER },
        params: { id: GIG_ID },
        body: {
            title: "Updated gig",
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

describe("Gig security regression tests", () => {
    test.each([
        ["invalid"],
        ["123"],
        [{ $ne: null }],
        [{ $gt: "" }],
        [["64c000000000000000000001"]]
    ])(
        "rejects invalid gig ID: %p",
        async (invalidId) => {
            const req = makeRequest();
            const res = makeResponse();

            req.params.id = invalidId;

            await getGigById(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(Gig.findById).not.toHaveBeenCalled();
        }
    );

    test.each([
        ["updateGig"],
        ["deleteGig"]
    ])(
        "%s rejects operator injection in route ID",
        async (handlerName) => {
            const req = makeRequest();
            const res = makeResponse();

            req.params.id = { $ne: null };

            await ({ updateGig, deleteGig })[handlerName](req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(Gig.findById).not.toHaveBeenCalled();
            expect(Gig.findOneAndUpdate).not.toHaveBeenCalled();
            expect(Gig.findOneAndDelete).not.toHaveBeenCalled();
        }
    );

    test("rejects invalid authenticated user IDs", async () => {
        const req = makeRequest();
        const res = makeResponse();

        req.user.userId = { $ne: null };

        await getMyGigs(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(Gig.find).not.toHaveBeenCalled();
    });

    test("prevents unauthorized gig updates", async () => {
        Gig.findById.mockResolvedValue({
            freelancer: OTHER_USER
        });

        const req = makeRequest();
        const res = makeResponse();

        await updateGig(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(Gig.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("prevents unauthorized gig deletion", async () => {
        Gig.findById.mockResolvedValue({
            freelancer: OTHER_USER
        });

        const req = makeRequest();
        const res = makeResponse();

        await deleteGig(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(Gig.findOneAndDelete).not.toHaveBeenCalled();
    });

    test("does not allow protected fields to be updated", async () => {
        Gig.findById.mockResolvedValue({
            freelancer: OWNER
        });

        Gig.findOneAndUpdate.mockResolvedValue({
            _id: GIG_ID,
            freelancer: OWNER,
            title: "Updated gig",
            price: 850
        });

        const req = makeRequest();
        const res = makeResponse();

        req.body = {
            title: "Updated gig",
            price: 850,
            freelancer: OTHER_USER,
            _id: OTHER_USER,
            createdAt: "2000-01-01"
        };

        await updateGig(req, res);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(Gig.findOneAndUpdate).toHaveBeenCalledWith(
            {
                _id: new mongoose.Types.ObjectId(GIG_ID),
                freelancer: new mongoose.Types.ObjectId(OWNER)
            },
            {
                $set: {
                    title: "Updated gig",
                    price: 850
                }
            },
            {
                new: true,
                runValidators: true
            }
        );
    });

    test("rejects updates containing only protected fields", async () => {
        Gig.findById.mockResolvedValue({
            freelancer: OWNER
        });

        const req = makeRequest();
        const res = makeResponse();

        req.body = {
            freelancer: OTHER_USER,
            _id: OTHER_USER
        };

        await updateGig(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(Gig.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("rejects invalid authenticated IDs during gig creation", async () => {
        const req = makeRequest();
        const res = makeResponse();

        req.user.userId = { $ne: null };

        await createGig(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(Gig).not.toHaveBeenCalled();
    });
});
