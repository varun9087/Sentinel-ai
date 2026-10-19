import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../components/Badge";

describe("Badge Component", () => {
  it("renders children correctly", () => {
    render(<Badge variant="success">Active Status</Badge>);
    expect(screen.getByText("Active Status")).toBeDefined();
  });

  it("applies variant classes properly", () => {
    const { container } = render(<Badge variant="error">Failure</Badge>);
    const badgeElement = container.querySelector("span");
    expect(badgeElement?.className).toContain("text-rose-400");
  });
});
