import {
  DAYS,
  HOURS,
  MINUTES,
  MONTHS,
  SECONDS,
  WEEKS,
  YEARS,
} from "../../constants/private";
import { DurationString } from "../../types";

export const calculateCurrentDuration = (
  milliseconds: number,
  duration: DurationString,
): number => {
  switch (duration) {
    case "years":
      return milliseconds / YEARS;

    case "months":
      return milliseconds / MONTHS;

    case "weeks":
      return milliseconds / WEEKS;

    case "days":
      return milliseconds / DAYS;

    case "hours":
      return milliseconds / HOURS;

    case "minutes":
      return milliseconds / MINUTES;

    case "seconds":
      return milliseconds / SECONDS;

    case "milliseconds":
      return milliseconds;

    default:
      throw new Error(`Invalid duration [ ${duration as any} ]`);
  }
};

export const calculateRemainingDuration = (
  milliseconds: number,
  duration: DurationString,
): number => {
  switch (duration) {
    case "years":
      return Math.floor(milliseconds) * YEARS;

    case "months":
      return Math.floor(milliseconds) * MONTHS;

    case "weeks":
      return Math.floor(milliseconds) * WEEKS;

    case "days":
      return Math.floor(milliseconds) * DAYS;

    case "hours":
      return Math.floor(milliseconds) * HOURS;

    case "minutes":
      return Math.floor(milliseconds) * MINUTES;

    case "seconds":
      return Math.floor(milliseconds) * SECONDS;

    case "milliseconds":
      return milliseconds;

    default:
      throw new Error(`Invalid duration [ ${duration as any} ]`);
  }
};
