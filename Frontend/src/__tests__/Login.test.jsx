import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MemoryRouter } from "react-router-dom";
import Login from "../pages/Login";
import { useAuth } from "../context/AuthContext";
import { getApiError } from "../services/api";

jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../services/api", () => ({ getApiError: jest.fn() }));

const signIn = jest.fn();

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe("Login", () => {
  beforeEach(() => {
    signIn.mockReset();
    useAuth.mockReturnValue({ signIn });
    getApiError.mockImplementation((error) => error.response?.data?.message || "Request failed.");
  });

  afterEach(cleanup);

  test("renders email and password inputs", () => {
    renderLogin();

    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  test("shows a validation error when submitted empty", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Please complete all required fields");
    expect(signIn).not.toHaveBeenCalled();
  });

  test("calls the auth API on a valid submit without displaying the password", async () => {
    const user = userEvent.setup();
    signIn.mockResolvedValue({ id: "user-1", email: "client@example.com", role: "client" });
    const { container } = renderLogin();
    const password = "SecretPass123!";

    await user.type(screen.getByLabelText("Email"), "client@example.com");
    await user.type(screen.getByLabelText("Password"), password);
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(signIn).toHaveBeenCalledWith({ email: "client@example.com", password });
    expect(container.textContent).not.toContain(password);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  test("shows the API error when the server returns 401", async () => {
    const user = userEvent.setup();
    signIn.mockRejectedValue({ response: { status: 401, data: { message: "Incorrect email or password." } } });
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "client@example.com");
    await user.type(screen.getByLabelText("Password"), "WrongPass123!");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
  });
});