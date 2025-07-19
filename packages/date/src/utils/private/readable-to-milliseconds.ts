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
import { readableToDuration } from "./readable-to-duration";

export const readableToMilliseconds = (...values: Array<ReadableTime>): number => {
  const object = readableToDuration(...values);
  let time = 0;

  time = time + object["milliseconds"];
  time = time + object["seconds"] * SECONDS;
  time = time + object["minutes"] * MINUTES;
  time = time + object["hours"] * HOURS;
  time = time + object["days"] * DAYS;
  time = time + object["weeks"] * WEEKS;
  time = time + object["months"] * MONTHS;
  time = time + object["years"] * YEARS;

  return Math.round(time);
};
