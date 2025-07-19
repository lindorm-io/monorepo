import { DurationDict, DurationString } from "../../types";
import {
  calculateCurrentDuration,
  calculateRemainingDuration,
} from "./calculate-duration";

const array: Array<DurationString> = [
  "years",
  "months",
  "weeks",
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
];

export const millisecondsToDuration = (milliseconds: number): DurationDict => {
  const object: DurationDict = {
    years: 0,
    months: 0,
    weeks: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  };

  let remaining: number = milliseconds;

  for (const key of array) {
    const duration = key as DurationString;
    const value = calculateCurrentDuration(remaining, duration);

    if (value < 1) continue;

    const floor = Math.floor(value);

    object[duration] = floor;

    remaining = remaining - calculateRemainingDuration(value, duration);
  }

  return object;
};
