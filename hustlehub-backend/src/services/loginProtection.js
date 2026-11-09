const { createHmac } = require("node:crypto");
const LoginAttempt = require("../models/LoginAttempt");

const LOGIN_POLICY = Object.freeze({
    maxFailures: 5,
    windowMs: 15 * 60 * 1000,
    cooldownMs: 15 * 60 * 1000,
    retentionMs: 30 * 60 * 1000
});

function identityKey(email) {
    const secret = process.env.JWT_SECRET;

    if (!secret || typeof email !== "string" || !email.trim()) {
        throw new Error(
            "Login protection configuration or identity is invalid."
        );
    }

    return createHmac("sha256", secret)
        .update(email.trim().toLowerCase())
        .digest("hex");
}

function stateFor(row, now) {
    const lockedUntil = row && row.lockedUntil
        ? new Date(row.lockedUntil).getTime()
        : 0;

    const locked = lockedUntil > now.getTime();

    const windowActive = row && row.resetAt &&
        new Date(row.resetAt).getTime() > now.getTime();

    return {
        locked,
        failedAttempts: row && (locked || windowActive)
            ? row.failedAttempts
            : 0,
        retryAfterSeconds: locked
            ? Math.ceil((lockedUntil - now.getTime()) / 1000)
            : 0
    };
}

async function updateState(key, pipeline) {
    let row;

    try {
        row = await LoginAttempt.findOneAndUpdate(
            { _id: key },
            pipeline,
            {
                upsert: true,
                returnDocument: "after",
                updatePipeline: true
            }
        );
    } catch (error) {
        // Concurrent first attempts may insert the same unique key.
        if (error.code !== 11000) throw error;

        row = await LoginAttempt.findOneAndUpdate(
            { _id: key },
            pipeline,
            {
                returnDocument: "after",
                updatePipeline: true
            }
        );
    }

    if (!row) {
        throw new Error(
            "Login protection state could not be updated."
        );
    }

    return row;
}

function createLoginProtection({ now = () => Date.now() } = {}) {
    async function getLoginCooldown(email) {
        const current = new Date(now());

        const row = await LoginAttempt.findById(
            identityKey(email)
        ).lean();

        return stateFor(row, current);
    }

    async function recordFailedLogin(email) {
        const current = new Date(now());
        const zero = new Date(0);

        const locked = {
            $gt: [
                { $ifNull: ["$lockedUntil", zero] },
                current
            ]
        };

        const active = {
            $gt: [
                { $ifNull: ["$resetAt", zero] },
                current
            ]
        };

        const row = await updateState(identityKey(email), [
            {
                $set: {
                    failedAttempts: {
                        $cond: [
                            locked,
                            "$failedAttempts",
                            {
                                $min: [
                                    LOGIN_POLICY.maxFailures,
                                    {
                                        $add: [
                                            {
                                                $cond: [
                                                    active,
                                                    {
                                                        $ifNull: [
                                                            "$failedAttempts",
                                                            0
                                                        ]
                                                    },
                                                    0
                                                ]
                                            },
                                            1
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $set: {
                    lockedUntil: {
                        $cond: [
                            locked,
                            "$lockedUntil",
                            {
                                $cond: [
                                    {
                                        $gte: [
                                            "$failedAttempts",
                                            LOGIN_POLICY.maxFailures
                                        ]
                                    },
                                    new Date(
                                        current.getTime() +
                                        LOGIN_POLICY.cooldownMs
                                    ),
                                    null
                                ]
                            }
                        ]
                    },
                    resetAt: {
                        $cond: [
                            { $or: [locked, active] },
                            "$resetAt",
                            new Date(
                                current.getTime() +
                                LOGIN_POLICY.windowMs
                            )
                        ]
                    },
                    expiresAt: new Date(
                        current.getTime() +
                        LOGIN_POLICY.retentionMs
                    )
                }
            }
        ]);

        return stateFor(row, current);
    }

    async function recordSuccessfulLogin(email) {
        const current = new Date(now());

        const locked = {
            $gt: [
                { $ifNull: ["$lockedUntil", new Date(0)] },
                current
            ]
        };

        const row = await updateState(identityKey(email), [
            {
                $set: {
                    failedAttempts: {
                        $cond: [locked, "$failedAttempts", 0]
                    },
                    lockedUntil: {
                        $cond: [locked, "$lockedUntil", null]
                    },
                    resetAt: {
                        $cond: [locked, "$resetAt", null]
                    },
                    expiresAt: new Date(
                        current.getTime() +
                        LOGIN_POLICY.retentionMs
                    )
                }
            }
        ]);

        return stateFor(row, current);
    }

    return {
        getLoginCooldown,
        recordFailedLogin,
        recordSuccessfulLogin
    };
}

module.exports = {
    ...createLoginProtection(),
    createLoginProtection,
    LOGIN_POLICY
};