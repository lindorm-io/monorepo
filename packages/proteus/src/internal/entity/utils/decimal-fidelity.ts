/**
 * Decimal ⇄ JS-number round-trip fidelity.
 *
 * A `NUMERIC`/`DECIMAL` column is arbitrary-precision; a JS `number` (IEEE-754
 * double) is not. `decimalFitsDouble` answers: can this decimal string be
 * represented as a `number` and read back to the *same decimal value*? If not,
 * proteus throws rather than silently truncate — the caller must declare the
 * field as `@Field("decimal", { mode: "string" })` to keep the exact string.
 */

type Canonical = { neg: boolean; coeff: bigint; scale: number };

const DECIMAL_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Parse a decimal string into a canonical (sign, coefficient, scale) triple so
 * two strings can be compared by *value* (1.50 === 1.5 === 15e-1), independent
 * of formatting or exponent notation. Returns null for non-numeric input.
 */
const canonical = (input: string): Canonical | null => {
  const s = input.trim();
  if (!DECIMAL_RE.test(s)) return null;

  let body = s;
  let neg = false;
  if (body[0] === "+" || body[0] === "-") {
    neg = body[0] === "-";
    body = body.slice(1);
  }

  let exp = 0;
  const eIdx = body.search(/[eE]/);
  if (eIdx >= 0) {
    exp = parseInt(body.slice(eIdx + 1), 10);
    body = body.slice(0, eIdx);
  }

  let intPart = body;
  let fracPart = "";
  const dot = body.indexOf(".");
  if (dot >= 0) {
    intPart = body.slice(0, dot);
    fracPart = body.slice(dot + 1);
  }

  const digits = `${intPart}${fracPart}` || "0";
  let coeff = BigInt(digits);
  let scale = fracPart.length - exp;

  // Strip trailing zeros so equal values share one canonical form.
  while (coeff !== 0n && coeff % 10n === 0n) {
    coeff /= 10n;
    scale -= 1;
  }
  if (coeff === 0n) return { neg: false, coeff: 0n, scale: 0 };

  return { neg, coeff, scale };
};

/**
 * True if the decimal string round-trips losslessly through a JS `number`.
 *
 * `Number(s)` is the candidate double; `String(Number(s))` is its shortest
 * decimal form. The value survives iff those two represent the same decimal —
 * so `8.03` (a "normal" number) passes even though the double isn't exactly
 * 8.03, while `0.123456789012345678` (18 significant digits) fails.
 */
export const decimalFitsDouble = (value: string): boolean => {
  const num = Number(value);
  if (!Number.isFinite(num)) return false;

  const a = canonical(value);
  const b = canonical(String(num));
  if (a === null || b === null) return false;

  return a.neg === b.neg && a.coeff === b.coeff && a.scale === b.scale;
};
