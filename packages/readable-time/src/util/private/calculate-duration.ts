import { DAYS, HOURS, MINUTES, MONTHS, SECONDS, WEEKS, YEARS } from "../../constants";
import { DateDuration } from "../../enums";

export const calculateCurrentDuration = (milliseconds: number, duration: DateDuration): number => {
  switch (duration) {
    case DateDuration.YEARS:
      return milliseconds / YEARS;

    case DateDuration.MONTHS:
      return milliseconds / MONTHS;

    case DateDuration.WEEKS:
      return milliseconds / WEEKS;

    case DateDuration.DAYS:
      return milliseconds / DAYS;

    case DateDuration.HOURS:
      return milliseconds / HOURS;

    case DateDuration.MINUTES:
      return milliseconds / MINUTES;

    case DateDuration.SECONDS:
      return milliseconds / SECONDS;

    case DateDuration.MILLISECONDS:
      return milliseconds;

    default:
      throw new Error(`Invalid duration [ ${duration} ]`);
  }
};

export const calculateRemainingDuration = (
  milliseconds: number,
  duration: DateDuration,
): number => {
  switch (duration) {
    case DateDuration.YEARS:
      return Math.floor(milliseconds) * YEARS;

    case DateDuration.MONTHS:
      return Math.floor(milliseconds) * MONTHS;

    case DateDuration.WEEKS:
      return Math.floor(milliseconds) * WEEKS;

    case DateDuration.DAYS:
      return Math.floor(milliseconds) * DAYS;

    case DateDuration.HOURS:
      return Math.floor(milliseconds) * HOURS;

    case DateDuration.MINUTES:
      return Math.floor(milliseconds) * MINUTES;

    case DateDuration.SECONDS:
      return Math.floor(milliseconds) * SECONDS;

    case DateDuration.MILLISECONDS:
      return milliseconds;

    default:
      throw new Error(`Invalid duration [ ${duration} ]`);
  }
};
