
const request = require("supertest");
const { issueAccessToken } = require("../src/services/sessionSecurity");
const bcrypt = require("bcryptjs");

const app = require("../src/app");
const User = require("../src/models/User");

describe("HustleHub+ authentication and RBAC", () => {
    let clientToken;
    let freelancerToken;

    const client = {
        name: "Test",
        surname: "Client",
        email: "client.test@example.com",
        password: "TestPass123!",
        role: "client"
    };

    const freelancer = {
        name: "Test",
        surname: "Freelancer",
        email: "freelancer.test@example.com",
        password: "TestPass123!",
        role: "freelancer"
    };

    beforeEach(async () => {
        const clientPassword = await bcrypt.hash(client.password, 10);
        const freelancerPassword = await bcrypt.hash(
            freelancer.password,
            10
        );

        await User.create([
            { ...client, password: clientPassword },
            { ...freelancer, password: freelancerPassword }
        ]);

        clientToken = issueAccessToken(
            await User.findOne({ email: client.email })
        );

        freelancerToken = issueAccessToken(
            await User.findOne({ email: freelancer.email })
        );
    });
    
    test("registers a new client without returning the password", async () => {
        const response = await request(app)
            .post("/register")
            .send({
                ...client,
                email: "new.client@example.com"
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.user.role).toBe("client");
        expect(response.body.user.password).toBeUndefined();
    });

    test("rejects duplicate email registration", async () => {
        const response = await request(app)
            .post("/register")
            .send(client);

        expect(response.status).toBe(409);
    });

    test("rejects unsupported roles during registration", async () => {
        const response = await request(app)
            .post("/register")
            .send({
                ...client,
                email: "unsupported.role@example.com",
                role: "admin"
            });

        expect(response.status).toBe(400);
    });

    test("logs in with valid credentials and returns a token", async () => {
        const response = await request(app)
            .post("/login")
            .send({
                email: client.email,
                password: client.password
            });

        expect(response.status).toBe(200);
        expect(response.body.token).toBeDefined();
        expect(response.body.user.password).toBeUndefined();
    });

    test("rejects an incorrect password", async () => {
        const response = await request(app)
            .post("/login")
            .send({
                email: client.email,
                password: "WrongPassword123!"
            });

        expect(response.status).toBe(401);
    });

    test("rejects profile access without a token", async () => {
        const response = await request(app).get("/profile");

        expect(response.status).toBe(401);
    });

    test("allows a client into the client area", async () => {
        const response = await request(app)
            .get("/client-area")
            .set("Authorization", `Bearer ${clientToken}`);

        expect(response.status).toBe(200);
    });

    test("blocks a client from the freelancer area", async () => {
        const response = await request(app)
            .get("/freelancer-area")
            .set("Authorization", `Bearer ${clientToken}`);

        expect(response.status).toBe(403);
    });

    test("allows a freelancer into the freelancer area", async () => {
        const response = await request(app)
            .get("/freelancer-area")
            .set("Authorization", `Bearer ${freelancerToken}`);

        expect(response.status).toBe(200);
    });

    test("blocks a freelancer from the client area", async () => {
        const response = await request(app)
            .get("/client-area")
            .set("Authorization", `Bearer ${freelancerToken}`);

        expect(response.status).toBe(403);
    });

    test("rejects a malformed JWT", async () => {
        const response = await request(app)
            .get("/profile")
            .set("Authorization", "Bearer invalid.token.value");

        expect(response.status).toBe(401);
    });
});
