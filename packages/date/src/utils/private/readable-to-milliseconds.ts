import {
  DAYS,
  HOURS,
  MINUTES,
  MONTHS,
  SECONDS,
  WEEKS,
  YEARS,
} from "../../constants/private";
import { DurationString } from "../../enums";
import { ReadableTime } from "../../types";
import { readableToDuration } from "./readable-to-duration";

export const readableToMilliseconds = (...values: Array<ReadableTime>): number => {
  const object = readableToDuration(...values);
  let time = 0;

  time = time + object[DurationString.Milliseconds];
  time = time + object[DurationString.Seconds] * SECONDS;
  time = time + object[DurationString.Minutes] * MINUTES;
  time = time + object[DurationString.Hours] * HOURS;
  time = time + object[DurationString.Days] * DAYS;
  time = time + object[DurationString.Weeks] * WEEKS;
  time = time + object[DurationString.Months] * MONTHS;
  time = time + object[DurationString.Years] * YEARS;

  return Math.round(time);
};
