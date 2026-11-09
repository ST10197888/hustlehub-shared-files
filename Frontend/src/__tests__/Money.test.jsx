
import { describe, expect, test } from "@jest/globals";
import {
  formatRand,
  formatPercent
} from "../utils/money";

describe("formatRand", () => {
  test.each([
    [0, "R0.00"],
    [1, "R1.00"],
    [12.5, "R12.50"],
    [1234.56, "R1\u00A0234.56"],
    [12345.67, "R12\u00A0345.67"],
    [1234567.89, "R1\u00A0234\u00A0567.89"],
    [-1234.56, "-R1\u00A0234.56"],
    [-0.001, "R0.00"],
    [null, "R0.00"],
    ["1234", "R0.00"],
    [Number.NaN, "R0.00"],
    [Infinity, "R0.00"]
  ])("formats %s correctly", (value, expected) => {
    expect(formatRand(value)).toBe(expected);
  });
});

describe("formatPercent", () => {
  test.each([
    [0, "0%"],
    [15.6, "15.6%"],
    [12.345, "12.35%"],
    [null, "0%"],
    [Number.NaN, "0%"]
  ])("formats %s correctly", (value, expected) => {
    expect(formatPercent(value)).toBe(expected);
  });
});
