export type ParsedRange =
  | { type: "ignore" }
  | { type: "unsatisfiable" }
  | { type: "satisfiable"; start: number; end: number };

const RANGE_PATTERN = /^bytes=(.+)$/;

// Single-range parser. Anything we cannot cleanly satisfy as one `bytes` range
// (absent, syntactically invalid, multiple ranges, other units) becomes
// `ignore` — serving the full 200 is always RFC 9110 compliant.
export const parseRangeHeader = (
  header: string | undefined,
  size: number,
): ParsedRange => {
  if (!header) return { type: "ignore" };

  const match = RANGE_PATTERN.exec(header.trim());
  if (!match) return { type: "ignore" };

  const spec = match[1].trim();
  if (spec.includes(",")) return { type: "ignore" };

  const dash = spec.indexOf("-");
  if (dash === -1) return { type: "ignore" };

  const startStr = spec.slice(0, dash).trim();
  const endStr = spec.slice(dash + 1).trim();

  if (startStr === "") {
    // Suffix range: `bytes=-N` → final N bytes.
    if (endStr === "") return { type: "ignore" };

    const n = Number(endStr);
    if (!Number.isInteger(n) || n < 0) return { type: "ignore" };
    if (n === 0 || size === 0) return { type: "unsatisfiable" };

    return { type: "satisfiable", start: Math.max(0, size - n), end: size - 1 };
  }

  const start = Number(startStr);
  if (!Number.isInteger(start) || start < 0) return { type: "ignore" };
  if (start >= size) return { type: "unsatisfiable" };

  let end: number;
  if (endStr === "") {
    end = size - 1;
  } else {
    const parsed = Number(endStr);
    if (!Number.isInteger(parsed) || parsed < start) return { type: "ignore" };
    end = Math.min(parsed, size - 1);
  }

  return { type: "satisfiable", start, end };
};
