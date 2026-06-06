import { describe, expect, it } from "vitest";
import { cn, formatMoney, priceLabel } from "@/lib/format";
import type { Money } from "@/lib/types";

const usd = (amount: string): Money => ({ amount, currencyCode: "USD" });

describe("formatMoney", () => {
  it("formats a whole-dollar amount with no decimals", () => {
    expect(formatMoney(usd("49"))).toBe("$49");
  });

  it("formats a fractional amount with two decimals", () => {
    expect(formatMoney(usd("49.99"))).toBe("$49.99");
  });

  it("respects a non-USD currency code", () => {
    expect(formatMoney({ amount: "10", currencyCode: "EUR" })).toBe("€10");
  });

  it("falls back to a raw string when the amount is not a number", () => {
    expect(formatMoney(usd("not-a-number"))).toBe("not-a-number USD");
  });
});

describe("priceLabel", () => {
  it("shows a single price when min === max", () => {
    expect(priceLabel(usd("29"), usd("29"))).toBe("$29");
  });

  it("shows a range when min !== max", () => {
    expect(priceLabel(usd("29"), usd("99"))).toBe("$29 – $99");
  });
});

describe("cn", () => {
  it("joins truthy class names and drops falsy ones", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("returns an empty string when nothing is truthy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });
});
