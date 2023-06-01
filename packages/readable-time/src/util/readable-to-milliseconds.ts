import { DAYS, HOURS, MINUTES, MONTHS, SECONDS, WEEKS, YEARS } from "../constants";
import { DateDuration } from "../enums";
import { ReadableTime } from "../types";
import { readableToDuration } from "./readable-to-duration";

export const readableToMilliseconds = (...values: Array<ReadableTime>): number => {
  const object = readableToDuration(...values);
  let time = 0;

  time = time + object[DateDuration.MILLISECONDS];
  time = time + object[DateDuration.SECONDS] * SECONDS;
  time = time + object[DateDuration.MINUTES] * MINUTES;
  time = time + object[DateDuration.HOURS] * HOURS;
  time = time + object[DateDuration.DAYS] * DAYS;
  time = time + object[DateDuration.WEEKS] * WEEKS;
  time = time + object[DateDuration.MONTHS] * MONTHS;
  time = time + object[DateDuration.YEARS] * YEARS;

  return Math.round(time);
};

export const readableMilliseconds = readableToMilliseconds;
