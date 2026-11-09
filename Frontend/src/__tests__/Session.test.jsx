import { AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  attachStoredToken,
  logoutSession
} from "../services/session";

const OLD_TOKEN = "current-session-token";
const OLD_USER = JSON.stringify({
  id: "user-1",
  name: "Test"
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("hustlehub_token", OLD_TOKEN);
  localStorage.setItem("hustlehub_user", OLD_USER);
});

afterEach(() => {
  localStorage.clear();
});

describe("Browser session handling", () => {
  test("attaches the stored token to requests without explicit authorization", () => {
    const config = attachStoredToken({
      headers: new AxiosHeaders()
    });

    expect(config.headers.get("Authorization"))
      .toBe(`Bearer ${OLD_TOKEN}`);
  });

  test("preserves explicit authorization for the session being logged out", () => {
    localStorage.setItem(
      "hustlehub_token",
      "new-session-token"
    );

    const config = attachStoredToken({
      headers: new AxiosHeaders({
        Authorization: `Bearer ${OLD_TOKEN}`
      })
    });

    expect(config.headers.get("Authorization"))
      .toBe(`Bearer ${OLD_TOKEN}`);
  });

  test("sends authenticated logout and clears storage after confirmation", async () => {
    const client = {
      post: jest.fn().mockResolvedValue({
        data: { success: true }
      })
    };

    await logoutSession(client);

    expect(client.post).toHaveBeenCalledWith(
      "/logout",
      {},
      {
        headers: {
          Authorization: `Bearer ${OLD_TOKEN}`
        },
        timeout: 10000
      }
    );

    expect(
      localStorage.getItem("hustlehub_token")
    ).toBeNull();

    expect(
      localStorage.getItem("hustlehub_user")
    ).toBeNull();
  });

  test("keeps credentials until the logout request finishes", async () => {
    let finish;

    const pending = new Promise((resolve) => {
      finish = resolve;
    });

    const completion = logoutSession({
      post: jest.fn().mockReturnValue(pending)
    });

    expect(
      localStorage.getItem("hustlehub_token")
    ).toBe(OLD_TOKEN);

    finish({ data: { success: true } });

    await completion;

    expect(
      localStorage.getItem("hustlehub_token")
    ).toBeNull();
  });

  test("clears an already expired or revoked session after a 401", async () => {
    const client = {
      post: jest.fn().mockRejectedValue({
        isAxiosError: true,
        response: { status: 401 }
      })
    };

    await logoutSession(client);

    expect(
      localStorage.getItem("hustlehub_token")
    ).toBeNull();

    expect(
      localStorage.getItem("hustlehub_user")
    ).toBeNull();
  });

  test("preserves credentials when the network request fails", async () => {
    const client = {
      post: jest.fn().mockRejectedValue(
        new Error("Network unavailable")
      )
    };

    await expect(
      logoutSession(client)
    ).rejects.toThrow();

    expect(
      localStorage.getItem("hustlehub_token")
    ).toBe(OLD_TOKEN);

    expect(
      localStorage.getItem("hustlehub_user")
    ).toBe(OLD_USER);
  });

  test("preserves credentials when the server cannot persist revocation", async () => {
    const client = {
      post: jest.fn().mockRejectedValue({
        isAxiosError: true,
        response: { status: 503 }
      })
    };

    await expect(
      logoutSession(client)
    ).rejects.toBeDefined();

    expect(
      localStorage.getItem("hustlehub_token")
    ).toBe(OLD_TOKEN);
  });

  test.each([
    { success: false },
    "unexpected HTML response"
  ])(
    "requires a successful logout confirmation: %j",
    async (data) => {
      const client = {
        post: jest.fn().mockResolvedValue({ data })
      };

      await expect(
        logoutSession(client)
      ).rejects.toThrow("did not confirm logout");

      expect(
        localStorage.getItem("hustlehub_token")
      ).toBe(OLD_TOKEN);
    }
  );

  test("preserves a new login that replaces the pending logout session", async () => {
    let finish;

    const pending = new Promise((resolve) => {
      finish = resolve;
    });

    const completion = logoutSession({
      post: jest.fn().mockReturnValue(pending)
    });

    localStorage.setItem(
      "hustlehub_token",
      "new-session-token"
    );

    localStorage.setItem(
      "hustlehub_user",
      "new-user-data"
    );

    finish({ data: { success: true } });

    await completion;

    expect(
      localStorage.getItem("hustlehub_token")
    ).toBe("new-session-token");

    expect(
      localStorage.getItem("hustlehub_user")
    ).toBe("new-user-data");
  });

  test("clears stale user data without a request when no token exists", async () => {
    localStorage.removeItem("hustlehub_token");

    const client = { post: jest.fn() };

    await logoutSession(client);

    expect(client.post).not.toHaveBeenCalled();

    expect(
      localStorage.getItem("hustlehub_user")
    ).toBeNull();
  });
});