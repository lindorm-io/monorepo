import { DurationString } from "../../types";

export const getDuration = (string: string): DurationString => {
  switch (string) {
    case "years":
    case "year":
    case "yrs":
    case "yr":
    case "y":
      return "years";

    case "months":
    case "month":
    case "mo":
      return "months";

    case "weeks":
    case "week":
    case "w":
      return "weeks";

    case "days":
    case "day":
    case "d":
      return "days";

    case "hours":
    case "hour":
    case "hrs":
    case "hr":
    case "h":
      return "hours";

    case "minutes":
    case "minute":
    case "mins":
    case "min":
    case "m":
      return "minutes";

    case "seconds":
    case "second":
    case "secs":
    case "sec":
    case "s":
      return "seconds";

    case "milliseconds":
    case "millisecond":
    case "msecs":
    case "msec":
    case "ms":
      return "milliseconds";

    default:
      throw new Error(`Invalid string time value [ ${string} ]`);
  }
};
