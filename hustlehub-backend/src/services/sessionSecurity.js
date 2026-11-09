const { randomUUID, createHash } = require("node:crypto");
const jwt = require("jsonwebtoken");
const RevokedSession = require("../models/RevokedSession");

const TOKEN_ISSUER = "hustlehub-api";
const TOKEN_AUDIENCE = "hustlehub-web";

const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireSessionClaims(claims) {
    if (
        !claims ||
        typeof claims !== "object" ||
        typeof claims.userId !== "string" ||
        !/^[a-f0-9]{24}$/i.test(claims.userId) ||
        typeof claims.email !== "string" ||
        !claims.email.trim() ||
        !["client", "freelancer"].includes(claims.role) ||
        claims.iss !== TOKEN_ISSUER ||
        claims.aud !== TOKEN_AUDIENCE ||
        typeof claims.jti !== "string" ||
        !UUID_V4.test(claims.jti) ||
        !Number.isSafeInteger(claims.exp) ||
        !Number.isFinite(new Date(claims.exp * 1000).getTime())
    ) {
        throw new jwt.JsonWebTokenError(
            "Invalid authentication token."
        );
    }

    return claims;
}

function issueAccessToken(user) {
    return jwt.sign({
        userId: user._id.toString(),
        email: user.email,
        role: user.role
    }, process.env.JWT_SECRET, {
        algorithm: "HS256",
        expiresIn: process.env.JWT_EXPIRES_IN || "1h",
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
        jwtid: randomUUID()
    });
}

function verifyAccessToken(token) {
    const claims = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE
    });

    return requireSessionClaims(claims);
}

function sessionKey(claims) {
    requireSessionClaims(claims);

    // Use signed claims, independent of JWT text representation.
    return createHash("sha256")
        .update(JSON.stringify([claims.iss, claims.jti]))
        .digest("hex");
}

async function isSessionRevoked(claims) {
    return Boolean(
        await RevokedSession.exists({
            _id: sessionKey(claims)
        })
    );
}

async function revokeSession(claims) {
    const key = sessionKey(claims);
    const expiresAt = new Date(claims.exp * 1000);

    if (expiresAt.getTime() <= Date.now()) return;

    try {
        await RevokedSession.updateOne(
            { _id: key },
            {
                $setOnInsert: {
                    userId: claims.userId,
                    revokedAt: new Date(),
                    expiresAt
                }
            },
            { upsert: true }
        );
    } catch (error) {
        // Concurrent logout requests can insert the same session.
        if (
            error.code !== 11000 ||
            !await RevokedSession.exists({ _id: key })
        ) {
            throw error;
        }
    }
}

module.exports = {
    issueAccessToken,
    verifyAccessToken,
    isSessionRevoked,
    revokeSession,
    TOKEN_ISSUER,
    TOKEN_AUDIENCE
};