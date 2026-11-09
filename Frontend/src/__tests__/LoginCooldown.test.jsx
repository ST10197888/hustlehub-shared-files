import {
  cleanup,
  render,
  screen
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, jest, test } from "@jest/globals";
import Login from "../pages/Login";
import { useAuth } from "../context/AuthContext";
import { getApiError } from "../services/api";

jest.mock("../context/AuthContext", () => ({
  useAuth: jest.fn()
}));

jest.mock("../services/api", () => ({
  getApiError: jest.fn()
}));

afterEach(cleanup);

test("shows the server cooldown message when login returns 429", async () => {
  const message =
    "Too many failed sign-in attempts. Please try again later.";

  const signIn = jest.fn().mockRejectedValue({
    response: {
      status: 429,
      data: {
        message,
        retryAfterSeconds: 900
      }
    }
  });

  useAuth.mockReturnValue({ signIn });

  getApiError.mockImplementation(
    (error) => error.response.data.message
  );

  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

  const user = userEvent.setup();

  await user.type(
    screen.getByLabelText("Email"),
    "client@example.com"
  );

  await user.type(
    screen.getByLabelText("Password"),
    "WrongPass123!"
  );

  await user.click(
    screen.getByRole("button", { name: "Log in" })
  );

  expect(
    await screen.findByRole("alert")
  ).toHaveTextContent(message);

  expect(
    screen.getByRole("button", { name: "Log in" })
  ).toBeEnabled();
});