import {
  DAYS,
  HOURS,
  MINUTES,
  MONTHS,
  SECONDS,
  WEEKS,
  YEARS,
} from "../../constants/private/time";
import { DurationString } from "../../enums";

export const calculateCurrentDuration = (
  milliseconds: number,
  duration: DurationString,
): number => {
  switch (duration) {
    case DurationString.Years:
      return milliseconds / YEARS;

    case DurationString.Months:
      return milliseconds / MONTHS;

    case DurationString.Weeks:
      return milliseconds / WEEKS;

    case DurationString.Days:
      return milliseconds / DAYS;

    case DurationString.Hours:
      return milliseconds / HOURS;

    case DurationString.Minutes:
      return milliseconds / MINUTES;

    case DurationString.Seconds:
      return milliseconds / SECONDS;

    case DurationString.Milliseconds:
      return milliseconds;

    default:
      throw new Error(`Invalid duration [ ${duration} ]`);
  }
};

export const calculateRemainingDuration = (
  milliseconds: number,
  duration: DurationString,
): number => {
  switch (duration) {
    case DurationString.Years:
      return Math.floor(milliseconds) * YEARS;

    case DurationString.Months:
      return Math.floor(milliseconds) * MONTHS;

    case DurationString.Weeks:
      return Math.floor(milliseconds) * WEEKS;

    case DurationString.Days:
      return Math.floor(milliseconds) * DAYS;

    case DurationString.Hours:
      return Math.floor(milliseconds) * HOURS;

    case DurationString.Minutes:
      return Math.floor(milliseconds) * MINUTES;

    case DurationString.Seconds:
      return Math.floor(milliseconds) * SECONDS;

    case DurationString.Milliseconds:
      return milliseconds;

    default:
      throw new Error(`Invalid duration [ ${duration} ]`);
  }
};
