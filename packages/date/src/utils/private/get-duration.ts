import { DurationString } from "../../enums";

export const getDuration = (string: string): DurationString => {
  switch (string) {
    case "years":
    case "year":
    case "yrs":
    case "yr":
    case "y":
      return DurationString.Years;

    case "months":
    case "month":
    case "mo":
      return DurationString.Months;

    case "weeks":
    case "week":
    case "w":
      return DurationString.Weeks;

    case "days":
    case "day":
    case "d":
      return DurationString.Days;

    case "hours":
    case "hour":
    case "hrs":
    case "hr":
    case "h":
      return DurationString.Hours;

    case "minutes":
    case "minute":
    case "mins":
    case "min":
    case "m":
      return DurationString.Minutes;

    case "seconds":
    case "second":
    case "secs":
    case "sec":
    case "s":
      return DurationString.Seconds;

    case "milliseconds":
    case "millisecond":
    case "msecs":
    case "msec":
    case "ms":
      return DurationString.Milliseconds;

    default:
      throw new Error(`Invalid string time value [ ${string} ]`);
  }
};
