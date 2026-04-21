import type { ReadableTime } from "../../types/index.js";
import {
  DAYS,
  HOURS,
  MINUTES,
  MONTHS,
  SECONDS,
  WEEKS,
  YEARS,
} from "../constants/time.js";

type Bucket = { unit: string; size: number; tolerance: number };

// Tolerance policy: each bucket's tolerance equals one unit of the next
// smaller bucket. Rationale — year/month units are estimates (Gregorian
// average), so a value like readableToMilliseconds("25y") produces a number
// that is not a clean integer multiple of YEARS after rounding through other
// intermediate conversions. Allowing a ±1-day slack on years, ±1-hour slack
// on months, etc. lets the inverse pick the most useful coarse unit instead
// of collapsing to a noisy lower unit. Smaller buckets (hour/minute/second)
// are exact multiples with zero tolerance — "90m" must not collapse to "1h".
const BUCKETS: Array<Bucket> = [
  { unit: "y", size: YEARS, tolerance: DAYS },
  { unit: "mo", size: MONTHS, tolerance: DAYS },
  { unit: "w", size: WEEKS, tolerance: HOURS },
  { unit: "d", size: DAYS, tolerance: HOURS },
  { unit: "h", size: HOURS, tolerance: 0 },
  { unit: "m", size: MINUTES, tolerance: 0 },
  { unit: "s", size: SECONDS, tolerance: 0 },
];

export const millisecondsToReadable = (milliseconds: number): ReadableTime => {
  for (const { unit, size, tolerance } of BUCKETS) {
    if (milliseconds < size) continue;

    const rounded = Math.round(milliseconds / size);
    const delta = Math.abs(milliseconds - rounded * size);

    if (delta <= tolerance) {
      return `${rounded}${unit}` as ReadableTime;
    }
  }

  return `${milliseconds}ms`;
};
