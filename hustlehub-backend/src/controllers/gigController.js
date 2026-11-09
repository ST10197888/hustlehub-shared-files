const Gig = require("../models/Gig");
const { parseMongoId } = require("../utils/mongoId");

function failGigRequest(req, res, reason) {
    req.logEvent("error", "gig.operation.failed", { reason });

    return res.status(500).json({
        success: false,
        message: "Unable to process the gig request. Try again later."
    });
}

const createGig = async (req, res) => {
    try {

        const freelancerId = parseMongoId(req.user?.userId);

        if (!freelancerId) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication."
            });
        }

        const { title, description, category, price } = req.body;

        const newGig = new Gig({
            title,
            description,
            category,
            price,
            freelancer: freelancerId
        });

        const savedGig = await newGig.save();

        return res.status(201).json({
            success: true,
            message: "Gig created successfully",
            data: savedGig
        });
    } catch {
        return failGigRequest(req, res, "creation_failed");
    }
};

const getAllGigs = async (req, res) => {
    try {
        const gigs = await Gig.find()
            .populate("freelancer", "name surname email");

        return res.status(200).json({
            success: true,
            count: gigs.length,
            data: gigs
        });
    } catch {
        return failGigRequest(req, res, "listing_failed");
    }
};

const getGigById = async (req, res) => {
    try {

            const gigId = parseMongoId(req.params.id);

            if (!gigId) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid gig ID."
                });
            }

            const gig = await Gig.findById(gigId)

            .populate("freelancer", "name surname email");

        if (!gig) {
            return res.status(404).json({
                success: false,
                message: "Gig not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: gig
        });
    } catch {
        return failGigRequest(req, res, "lookup_failed");
    }
};

const getMyGigs = async (req, res) => {
    try {

        const freelancerId = parseMongoId(req.user?.userId);

        if (!freelancerId) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication."
            });
        }

        const gigs = await Gig.find({
            freelancer: freelancerId
        });


        return res.status(200).json({
            success: true,
            count: gigs.length,
            data: gigs
        });
    } catch {
        return failGigRequest(req, res, "owned_listing_failed");
    }
};


const updateGig = async (req, res) => {
    try {
        const gigId = parseMongoId(req.params.id);
        const freelancerId = parseMongoId(req.user?.userId);

        if (!freelancerId) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication."
            });
        }

        if (!gigId) {
            return res.status(400).json({
                success: false,
                message: "Invalid gig ID."
            });
        }

        const existingGig = await Gig.findById(gigId);

        if (!existingGig) {
            return res.status(404).json({
                success: false,
                message: "Gig not found"
            });
        }

        if (
            existingGig.freelancer.toString() !==
            freelancerId.toString()
        ) {
            req.logEvent("warn", "authorization.denied", {
                reason: "gig_update_ownership_required"
            });

            return res.status(403).json({
                success: false,
                message: "Not authorized to update this gig"
            });
        }

        const allowedFields = [
            "title",
            "description",
            "category",
            "price"
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (
                Object.prototype.hasOwnProperty.call(
                    req.body || {},
                    field
                )
            ) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid update fields provided."
            });
        }

        const gig = await Gig.findOneAndUpdate(
            {
                _id: gigId,
                freelancer: freelancerId
            },
            { $set: updates },
            {
                new: true,
                runValidators: true
            }
        );

        if (!gig) {
            return res.status(404).json({
                success: false,
                message: "Gig no longer available."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Gig updated successfully",
            data: gig
        });
    } catch {
        return failGigRequest(req, res, "update_failed");
    }
};



const deleteGig = async (req, res) => {
    try {
        const gigId = parseMongoId(req.params.id);
        const freelancerId = parseMongoId(req.user?.userId);

        if (!freelancerId) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication."
            });
        }

        if (!gigId) {
            return res.status(400).json({
                success: false,
                message: "Invalid gig ID."
            });
        }

        const existingGig = await Gig.findById(gigId);

        if (!existingGig) {
            return res.status(404).json({
                success: false,
                message: "Gig not found"
            });
        }

        if (
            existingGig.freelancer.toString() !==
            freelancerId.toString()
        ) {
            req.logEvent("warn", "authorization.denied", {
                reason: "gig_delete_ownership_required"
            });

            return res.status(403).json({
                success: false,
                message: "Not authorized to delete this gig"
            });
        }

        const deletedGig = await Gig.findOneAndDelete({
            _id: gigId,
            freelancer: freelancerId
        });

        if (!deletedGig) {
            return res.status(404).json({
                success: false,
                message: "Gig no longer available."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Gig deleted successfully"
        });
    } catch {
        return failGigRequest(req, res, "deletion_failed");
    }
};


module.exports = {
    createGig,
    getAllGigs,
    getGigById,
    getMyGigs,
    updateGig,
    deleteGig
};