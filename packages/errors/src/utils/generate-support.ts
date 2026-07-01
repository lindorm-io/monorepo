import { randomString } from "@lindorm/random";

// One unambiguous letter per month (Jan=A … Dec=N), skipping I/L/O so the code
// stays readable when spoken. `Date#getUTCMonth()` (0-11) indexes directly.
const MONTH_LETTERS = "ABCDEFGHJKMN";

/**
 * Generate a human-readable support reference code, e.g. `G01-A3F9-2XZ7`:
 *
 * - a **date prefix** `<monthLetter><day>` in UTC (matches the error's
 *   serialized timestamp), so the code tells you *which day* it was minted and
 * - two 4-character groups from an unambiguous alphabet (no `0/O/1/I/L`).
 *
 * The date prefix also partitions the (deliberately small, quotable) random
 * space by day, so collisions effectively only matter within a single day. It
 * is a correlation reference, not a secret — every error also carries a unique
 * `id`.
 */
export const generateSupport = (date: Date = new Date()): string => {
  const month = MONTH_LETTERS[date.getUTCMonth()];
  const day = String(date.getUTCDate()).padStart(2, "0");
  const random = `${randomString(4, "unambiguous")}-${randomString(4, "unambiguous")}`;

  return `${month}${day}-${random}`;
};
