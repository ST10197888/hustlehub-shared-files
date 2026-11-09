
/**
 * Adds non-breaking spaces as thousands separators.
 * Uses linear string processing instead of regex backtracking.
 */
function addThousandsSeparators(value: string): string {
  const parts: string[] = [];

  for (let end = value.length; end > 0; end -= 3) {
    const start = Math.max(0, end - 3);
    parts.push(value.slice(start, end));
  }

  return parts.reverse().join("\u00A0");
}

/** Formats a rand amount as "R12 345.67". Invalid values show as R0.00. */
export function formatRand(value: unknown): string {
  const number =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : 0;

  const cents = Math.round(Math.abs(number) * 100);

  const rand = addThousandsSeparators(
    Math.floor(cents / 100).toString()
  );

  const decimals = String(cents % 100).padStart(2, "0");

  return `${number < 0 && cents > 0 ? "-" : ""}R${rand}.${decimals}`;
}

/** Formats a percentage such as 15.6 as "15.6%". */
export function formatPercent(value: unknown): string {
  const number =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : 0;

  return `${Math.round(number * 100) / 100}%`;
}