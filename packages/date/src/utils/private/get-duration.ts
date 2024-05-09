import { DurationString } from "../../enums";

export const _getDuration = (string: string): DurationString => {
  switch (string) {
    case "years":
    case "year":
    case "yrs":
    case "yr":
    case "y":
      return DurationString.YEARS;

    case "months":
    case "month":
    case "mo":
      return DurationString.MONTHS;

    case "weeks":
    case "week":
    case "w":
      return DurationString.WEEKS;

    case "days":
    case "day":
    case "d":
      return DurationString.DAYS;

    case "hours":
    case "hour":
    case "hrs":
    case "hr":
    case "h":
      return DurationString.HOURS;

    case "minutes":
    case "minute":
    case "mins":
    case "min":
    case "m":
      return DurationString.MINUTES;

    case "seconds":
    case "second":
    case "secs":
    case "sec":
    case "s":
      return DurationString.SECONDS;

    case "milliseconds":
    case "millisecond":
    case "msecs":
    case "msec":
    case "ms":
      return DurationString.MILLISECONDS;

    default:
      throw new Error(`Invalid string time value [ ${string} ]`);
  }
};
