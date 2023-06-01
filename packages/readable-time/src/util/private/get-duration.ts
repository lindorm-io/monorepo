import { DateDuration } from "../../enums";

export const getDuration = (string: string): DateDuration => {
  switch (string) {
    case "years":
    case "year":
    case "yrs":
    case "yr":
    case "y":
      return DateDuration.YEARS;

    case "months":
    case "month":
    case "mo":
      return DateDuration.MONTHS;

    case "weeks":
    case "week":
    case "w":
      return DateDuration.WEEKS;

    case "days":
    case "day":
    case "d":
      return DateDuration.DAYS;

    case "hours":
    case "hour":
    case "hrs":
    case "hr":
    case "h":
      return DateDuration.HOURS;

    case "minutes":
    case "minute":
    case "mins":
    case "min":
    case "m":
      return DateDuration.MINUTES;

    case "seconds":
    case "second":
    case "secs":
    case "sec":
    case "s":
      return DateDuration.SECONDS;

    case "milliseconds":
    case "millisecond":
    case "msecs":
    case "msec":
    case "ms":
      return DateDuration.MILLISECONDS;

    default:
      throw new Error(`Invalid string time value [ ${string} ]`);
  }
};
