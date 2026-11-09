import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MemoryRouter, useNavigate } from "react-router-dom";
import CreateGig from "../pages/CreateGig";
import MyBookings from "../pages/MyBookings";
import { useAuth } from "../context/AuthContext";
import { createGig, getApiError, getMyBookings } from "../services/api";

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn()
}));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../services/api", () => ({
  createGig: jest.fn(),
  getApiError: jest.fn(),
  getMyBookings: jest.fn()
}));

const mockNavigate = jest.fn();

describe("Role-based dashboards", () => {
  beforeEach(() => {
    useNavigate.mockReturnValue(mockNavigate);
    mockNavigate.mockReset();
    useAuth.mockReset();
    createGig.mockReset();
    getMyBookings.mockReset();
    getApiError.mockReset();
    getMyBookings.mockResolvedValue([]);
  });

  afterEach(cleanup);

  test("renders the client bookings dashboard for a client", async () => {
    useAuth.mockReturnValue({ user: { id: "client-1", role: "client" } });
    render(<MemoryRouter><MyBookings /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "My bookings" })).toBeInTheDocument();
    expect(await screen.findByText(/You haven’t booked a gig yet/)).toBeInTheDocument();
    expect(getMyBookings).toHaveBeenCalledTimes(1);
  });

  test("shows the freelancer role restriction on the client bookings dashboard", () => {
    useAuth.mockReturnValue({ user: { id: "freelancer-1", role: "freelancer" } });
    render(<MemoryRouter><MyBookings /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Client account required" })).toBeInTheDocument();
    expect(getMyBookings).not.toHaveBeenCalled();
  });

  test("renders the gig management dashboard for a freelancer", () => {
    useAuth.mockReturnValue({ user: { id: "freelancer-1", role: "freelancer" } });
    render(<MemoryRouter><CreateGig /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Post a gig" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish gig" })).toBeInTheDocument();
  });

  test("navigates to the created gig after freelancer submission", async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { id: "freelancer-1", role: "freelancer" } });
    createGig.mockResolvedValue({ id: "gig-55" });
    render(<MemoryRouter><CreateGig /></MemoryRouter>);

    await user.type(screen.getByLabelText("Gig title"), "Logo design");
    await user.type(screen.getByLabelText("Category"), "Design");
    await user.type(screen.getByLabelText("Description"), "A custom logo");
    await user.type(screen.getByLabelText("Price (R)"), "250");
    await user.click(screen.getByRole("button", { name: "Publish gig" }));

    expect(createGig).toHaveBeenCalledWith({
      title: "Logo design",
      category: "Design",
      description: "A custom logo",
      price: 250
    });
    expect(mockNavigate).toHaveBeenCalledWith("/gigs/gig-55");
  });

  test("shows the freelancer role restriction when a client opens gig management", () => {
    useAuth.mockReturnValue({ user: { id: "client-1", role: "client" } });
    render(<MemoryRouter><CreateGig /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Freelancer account required" })).toBeInTheDocument();
  });
});