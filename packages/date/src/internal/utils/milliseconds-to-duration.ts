import type { DurationDict, DurationString } from "../../types/index.js";
import {
  DAYS,
  HOURS,
  MINUTES,
  MONTHS,
  SECONDS,
  WEEKS,
  YEARS,
} from "../constants/time.js";

type Bucket = { key: DurationString; size: number; tolerance: number };

// Same coarse-match philosophy as millisecondsToReadable: when the quotient
// for a bucket is within one unit of the next-smaller bucket of an integer,
// treat it as that integer (absorbs residuals from estimation rounding).
const BUCKETS: Array<Bucket> = [
  { key: "years", size: YEARS, tolerance: DAYS },
  { key: "months", size: MONTHS, tolerance: DAYS },
  { key: "weeks", size: WEEKS, tolerance: HOURS },
  { key: "days", size: DAYS, tolerance: HOURS },
  { key: "hours", size: HOURS, tolerance: 0 },
  { key: "minutes", size: MINUTES, tolerance: 0 },
  { key: "seconds", size: SECONDS, tolerance: 0 },
];

export const millisecondsToDuration = (milliseconds: number): DurationDict => {
  const object: DurationDict = {
    years: 0,
    months: 0,
    weeks: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  };

  let remaining = milliseconds;

  for (const { key, size, tolerance } of BUCKETS) {
    if (remaining < size) continue;

    const ceilCandidate = Math.ceil(remaining / size);
    const ceilResidual = Math.abs(ceilCandidate * size - remaining);

    let count: number;
    if (ceilResidual <= tolerance) {
      count = ceilCandidate;
    } else {
      count = Math.floor(remaining / size);
    }

    if (count < 1) continue;

    object[key] = count;
    remaining = remaining - count * size;
  }

  object.milliseconds = Math.max(0, Math.round(remaining));

  return object;
};
