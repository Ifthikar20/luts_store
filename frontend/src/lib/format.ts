import type { Money } from "./types";

// Format a Money object for display. Currency formatting is presentational only;
// authoritative amounts always come from the API.
export function formatMoney(money: Money): string {
  const amount = Number.parseFloat(money.amount);
  if (Number.isNaN(amount)) return `${money.amount} ${money.currencyCode}`;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: money.currencyCode || "USD",
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function priceLabel(min: Money, max: Money): string {
  if (min.amount === max.amount) return formatMoney(min);
  return `${formatMoney(min)} – ${formatMoney(max)}`;
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
