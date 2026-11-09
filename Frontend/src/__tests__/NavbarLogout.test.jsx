import {
  act,
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  MemoryRouter,
  useLocation
} from "react-router-dom";

import { AuthProvider } from "../context/AuthContext";
import Navbar from "../components/Navbar";

import {
  getStoredUser,
  logout,
  getApiError
} from "../services/api";

jest.mock("../services/api", () => ({
  getStoredUser: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  getApiError: jest.fn()
}));

const USER = {
  id: "user-1",
  name: "Test",
  role: "client"
};

function Location() {
  const location = useLocation();

  return (
    <p data-testid="location">
      {location.pathname}
    </p>
  );
}

function renderNavbar() {
  return render(
    <MemoryRouter initialEntries={["/gigs"]}>
      <AuthProvider>
        <Navbar />
        <Location />
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  logout.mockReset();
  getStoredUser.mockReset();
  getStoredUser.mockReturnValue(USER);

  getApiError.mockImplementation(
    (error) =>
      error.response?.data?.message || error.message
  );
});

afterEach(cleanup);

describe("Navbar logout", () => {
  test("waits for confirmation, disables repeat clicks and then navigates home", async () => {
    const browserUser = userEvent.setup();
    let finish;

    logout.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    renderNavbar();

    await browserUser.click(
      screen.getByRole("button", { name: "Log out" })
    );

    const button = screen.getByRole("button", {
      name: "Logging out…"
    });

    expect(button).toBeDisabled();

    await browserUser.click(button);

    expect(logout).toHaveBeenCalledTimes(1);

    expect(
      screen.getByTestId("location")
    ).toHaveTextContent("/gigs");

    expect(
      screen.getByText("Hi, Test")
    ).toBeInTheDocument();

    await act(async () => {
      getStoredUser.mockReturnValue(null);
      finish();
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("location").textContent
      ).toBe("/");
    });

    expect(
      screen.getByRole("link", { name: "Log in" })
    ).toBeInTheDocument();
  });

  test("updates authentication state after successful logout", async () => {
    logout.mockImplementation(async () => {
      getStoredUser.mockReturnValue(null);
    });

    renderNavbar();

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Log out" })
    );

    expect(
      await screen.findByRole("link", { name: "Log in" })
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Hi, Test")
    ).not.toBeInTheDocument();
  });

  test("shows failed logout without navigating or clearing authentication state", async () => {
    logout.mockRejectedValue({
      response: {
        status: 503,
        data: {
          message:
            "Unable to sign out securely. Please try again."
        }
      }
    });

    renderNavbar();

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Log out" })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Unable to sign out securely");

    expect(
      screen.getByText("Hi, Test")
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("location").textContent
    ).toBe("/gigs");

    expect(
      screen.getByRole("button", { name: "Log out" })
    ).toBeEnabled();
  });

  test("allows retry after a failed logout", async () => {
    logout
      .mockRejectedValueOnce(new Error("Try again"))
      .mockImplementationOnce(async () => {
        getStoredUser.mockReturnValue(null);
      });

    renderNavbar();

    const browserUser = userEvent.setup();

    await browserUser.click(
      screen.getByRole("button", { name: "Log out" })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Try again");

    await browserUser.click(
      screen.getByRole("button", { name: "Log out" })
    );

    expect(
      await screen.findByRole("link", { name: "Log in" })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("alert")
    ).not.toBeInTheDocument();
  });

  test("keeps a newer login in context when an older logout finishes", async () => {
    let finish;

    logout.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    renderNavbar();

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Log out" })
    );

    await act(async () => {
      getStoredUser.mockReturnValue({
        ...USER,
        id: "user-2",
        name: "New"
      });

      finish();
    });

    expect(
      await screen.findByText("Hi, New")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Log out" })
    ).toBeInTheDocument();
  });
});