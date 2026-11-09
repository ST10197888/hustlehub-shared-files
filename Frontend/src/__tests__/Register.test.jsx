import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MemoryRouter } from "react-router-dom";
import Register from "../pages/Register";
import { getApiError, register } from "../services/api";

jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../services/api", () => ({ getApiError: jest.fn(), register: jest.fn() }));

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );
}

describe("Register", () => {
  beforeEach(() => {
    register.mockReset();
    getApiError.mockImplementation((error) => error.response?.data?.message || "Request failed.");
  });

  afterEach(cleanup);

  test("renders email and password inputs", () => {
    renderRegister();

    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  test("shows a validation error when submitted empty", async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Please complete all required fields");
    expect(register).not.toHaveBeenCalled();
  });

  test("calls the registration API on a valid submit without displaying the password", async () => {
    const user = userEvent.setup();
    register.mockResolvedValue({ id: "user-2", email: "new@example.com", role: "client" });
    const { container } = renderRegister();
    const password = "RegisterPass123!";

    await user.type(screen.getByLabelText("First name"), "New");
    await user.type(screen.getByLabelText("Surname"), "Client");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), password);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(register).toHaveBeenCalledWith({
      name: "New",
      surname: "Client",
      email: "new@example.com",
      password,
      role: "client"
    });
    expect(container.textContent).not.toContain(password);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  test("shows the API error when the server returns 401", async () => {
    const user = userEvent.setup();
    register.mockRejectedValue({ response: { status: 401, data: { message: "Registration is unauthorized." } } });
    renderRegister();

    await user.type(screen.getByLabelText("First name"), "New");
    await user.type(screen.getByLabelText("Surname"), "Client");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "RegisterPass123!");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Registration is unauthorized.");
  });
});