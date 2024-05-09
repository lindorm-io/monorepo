import {
  _DAYS,
  _HOURS,
  _MINUTES,
  _MONTHS,
  _SECONDS,
  _WEEKS,
  _YEARS,
} from "../../constants/private/time";
import { ReadableTime } from "../../types";

export const _millisecondsToReadable = (milliseconds: number): ReadableTime => {
  const y = milliseconds / _YEARS;
  const mo = milliseconds / _MONTHS;
  const w = milliseconds / _WEEKS;
  const d = milliseconds / _DAYS;
  const h = milliseconds / _HOURS;
  const m = milliseconds / _MINUTES;
  const s = milliseconds / _SECONDS;

  if (Math.floor(y) === y) return `${y}y`;
  if (Math.floor(mo) === mo) return `${mo}mo`;
  if (Math.floor(w) === w) return `${w}w`;
  if (Math.floor(d) === d) return `${d}d`;
  if (Math.floor(h) === h) return `${h}h`;
  if (Math.floor(m) === m) return `${m}m`;
  if (Math.floor(s) === s) return `${s}s`;

  return `${milliseconds}ms`;
};
