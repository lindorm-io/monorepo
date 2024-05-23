import { DurationString } from "../../enums";
import { DurationDict } from "../../types";
import {
  calculateCurrentDuration,
  calculateRemainingDuration,
} from "./calculate-duration";

export const millisecondsToDuration = (milliseconds: number): DurationDict => {
  const object: DurationDict = {
    [DurationString.Years]: 0,
    [DurationString.Months]: 0,
    [DurationString.Weeks]: 0,
    [DurationString.Days]: 0,
    [DurationString.Hours]: 0,
    [DurationString.Minutes]: 0,
    [DurationString.Seconds]: 0,
    [DurationString.Milliseconds]: 0,
  };

  let remaining: number = milliseconds;

  for (const key of Object.values(DurationString)) {
    const duration = key as DurationString;
    const value = calculateCurrentDuration(remaining, duration);

    if (value < 1) continue;

    const floor = Math.floor(value);

    object[duration] = floor;

    remaining = remaining - calculateRemainingDuration(value, duration);
  }

  return object;
};
