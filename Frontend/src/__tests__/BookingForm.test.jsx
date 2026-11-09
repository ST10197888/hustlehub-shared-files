import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import GigDetails from "../pages/GigDetails";
import { useAuth } from "../context/AuthContext";
import { createBooking, getApiError, getGig } from "../services/api";

jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../services/api", () => ({
  createBooking: jest.fn(),
  getApiError: jest.fn(),
  getGig: jest.fn()
}));

const gig = {
  id: "gig-1",
  title: "Logo design",
  category: "Design",
  description: "A custom logo",
  price: 250,
  seller: "Alex Freelancer",
  rating: null
};

function renderBookingPage(path = "/gigs/gig-1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/gigs/:id" element={<GigDetails />} />
        <Route path="*" element={<GigDetails />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Booking form", () => {
  beforeEach(() => {
    getGig.mockReset();
    createBooking.mockReset();
    getApiError.mockReset();
    useAuth.mockReturnValue({ user: { id: "client-1", role: "client" } });
    getGig.mockResolvedValue(gig);
    getApiError.mockImplementation((error) => error.response?.data?.message || "Request failed.");
  });

  afterEach(cleanup);

  test("requires a valid gig before a booking can be submitted", async () => {
    getGig.mockResolvedValue(null);
    renderBookingPage();

    expect(await screen.findByRole("heading", { name: "Gig not found" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Book this gig" })).not.toBeInTheDocument();
    expect(getGig).toHaveBeenCalledWith("gig-1");
    expect(createBooking).not.toHaveBeenCalled();
  });

  test("posts a booking and shows confirmation on success", async () => {
    const user = userEvent.setup();
    createBooking.mockResolvedValue({
      success: true,
      message: "Booking confirmed.",
      confirmation: { transactionId: "TXN-123" }
    });
    renderBookingPage();

    await screen.findByRole("heading", { name: gig.title });
    await user.type(screen.getByLabelText("Notes for the freelancer (optional)"), "Please start next week.");
    await user.click(screen.getByRole("button", { name: "Book this gig" }));

    expect(createBooking).toHaveBeenCalledWith("gig-1", "Please start next week.");
    expect(await screen.findByText("Booking confirmed. Confirmation: TXN-123")).toBeInTheDocument();
  });

  test("shows an error when booking submission fails", async () => {
    const user = userEvent.setup();
    createBooking.mockRejectedValue({ response: { status: 500, data: { message: "Booking could not be completed." } } });
    renderBookingPage();

    await screen.findByRole("heading", { name: gig.title });
    await user.click(screen.getByRole("button", { name: "Book this gig" }));

    expect(await screen.findByText("Booking could not be completed.")).toBeInTheDocument();
  });
});