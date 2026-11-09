
const User = require("../src/models/User");

function makeUser(email) {
    return new User({
        name: "Test",
        surname: "User",
        email,
        password: "TestPassword123!",
        role: "client"
    });
}


describe("User email validation", () => {
    test.each([
        "user@example.com",
        "first.last@example.co.za",
        "user+tag@example.com",
        "user@example.com "
    ])("accepts valid email: %s", async (email) => {
        const user = makeUser(email);

        await expect(user.validate()).resolves.toBeUndefined();
    });

    test.each([
        "invalid",
        "user@",
        "@example.com",
        "user@example",
        "user@example.",
        "user@@example.com",
        "user name@example.com",
        "user@example .com",
        "a".repeat(250) + "@example.com"
    ])("rejects invalid email: %s", async (email) => {
        const user = makeUser(email);

        await expect(user.validate()).rejects.toThrow();
    });
});