import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MemoryRouter } from "react-router-dom";
import Browse from "../pages/Browse";
import { getApiError, getGigs } from "../services/api";

jest.mock("../services/api", () => ({
  getApiError: jest.fn(),
  getGigs: jest.fn()
}));

const gigs = [
  {
    id: "gig-1",
    title: "Logo design",
    category: "Design",
    description: "A custom logo",
    price: 250,
    seller: "Alex Freelancer",
    rating: 4.8
  },
  {
    id: "gig-2",
    title: "Website audit",
    category: "Development",
    description: "A thorough audit",
    price: 500,
    seller: "Sam Developer",
    rating: null
  }
];

describe("Gig list", () => {
  beforeEach(() => {
    getGigs.mockReset();
    getApiError.mockReset();
  });

  afterEach(cleanup);

  test("renders gig cards returned by the API", async () => {
    getGigs.mockResolvedValue(gigs);
    render(<MemoryRouter><Browse /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Logo design" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Website audit" })).toBeInTheDocument();
    expect(getGigs).toHaveBeenCalledTimes(1);
  });

  test("shows the empty state when the API returns no gigs", async () => {
    getGigs.mockResolvedValue([]);
    render(<MemoryRouter><Browse /></MemoryRouter>);

    expect(await screen.findByText("No gigs have been posted yet.")).toBeInTheDocument();
  });
});