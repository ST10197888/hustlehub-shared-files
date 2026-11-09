import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "@jest/globals";
import { MemoryRouter, useLocation } from "react-router-dom";
import GigCard from "../components/GigCard";

const gig = {
  id: "gig-42",
  title: "Portrait photography",
  category: "Photography",
  description: "Portrait sessions",
  price: 800,
  seller: "Taylor Photographer",
  rating: 4.9
};

function CurrentPath() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}</output>;
}

describe("GigCard", () => {
  afterEach(cleanup);

  test("shows its title, category, and price", () => {
    render(<MemoryRouter><GigCard gig={gig} /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: gig.title })).toBeInTheDocument();
    expect(screen.getByText(gig.category)).toBeInTheDocument();
    expect(screen.getByText("From R800")).toBeInTheDocument();
  });

  test("navigates to the gig details when its title is clicked", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/gigs"]}><GigCard gig={gig} /><CurrentPath /></MemoryRouter>);

    await user.click(screen.getByRole("link", { name: gig.title }));

    expect(screen.getByTestId("current-path")).toHaveTextContent("/gigs/gig-42");
  });
});