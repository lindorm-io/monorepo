import {
  _DAYS,
  _HOURS,
  _MINUTES,
  _MONTHS,
  _SECONDS,
  _WEEKS,
  _YEARS,
} from "../../constants/private/time";
import { DurationString } from "../../enums";
import { ReadableTime } from "../../types";
import { _readableToDuration } from "./readable-to-duration";

export const _readableToMilliseconds = (...values: Array<ReadableTime>): number => {
  const object = _readableToDuration(...values);
  let time = 0;

  time = time + object[DurationString.MILLISECONDS];
  time = time + object[DurationString.SECONDS] * _SECONDS;
  time = time + object[DurationString.MINUTES] * _MINUTES;
  time = time + object[DurationString.HOURS] * _HOURS;
  time = time + object[DurationString.DAYS] * _DAYS;
  time = time + object[DurationString.WEEKS] * _WEEKS;
  time = time + object[DurationString.MONTHS] * _MONTHS;
  time = time + object[DurationString.YEARS] * _YEARS;

  return Math.round(time);
};
