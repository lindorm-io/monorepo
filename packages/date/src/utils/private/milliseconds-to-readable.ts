import {
  DAYS,
  HOURS,
  MINUTES,
  MONTHS,
  SECONDS,
  WEEKS,
  YEARS,
} from "../../constants/private";
import { ReadableTime } from "../../types";

export const millisecondsToReadable = (milliseconds: number): ReadableTime => {
  const y = milliseconds / YEARS;
  const mo = milliseconds / MONTHS;
  const w = milliseconds / WEEKS;
  const d = milliseconds / DAYS;
  const h = milliseconds / HOURS;
  const m = milliseconds / MINUTES;
  const s = milliseconds / SECONDS;

  if (Math.floor(y) === y) return `${y}y`;
  if (Math.floor(mo) === mo) return `${mo}mo`;
  if (Math.floor(w) === w) return `${w}w`;
  if (Math.floor(d) === d) return `${d}d`;
  if (Math.floor(h) === h) return `${h}h`;
  if (Math.floor(m) === m) return `${m}m`;
  if (Math.floor(s) === s) return `${s}s`;

  return `${milliseconds}ms`;
};
