import { DateDuration } from "../enums";
import { DurationDictionary } from "../types";
import { calculateCurrentDuration, calculateRemainingDuration } from "./private";

export const millisecondsToDuration = (milliseconds: number): DurationDictionary => {
  const object: DurationDictionary = {
    [DateDuration.YEARS]: 0,
    [DateDuration.MONTHS]: 0,
    [DateDuration.WEEKS]: 0,
    [DateDuration.DAYS]: 0,
    [DateDuration.HOURS]: 0,
    [DateDuration.MINUTES]: 0,
    [DateDuration.SECONDS]: 0,
    [DateDuration.MILLISECONDS]: 0,
  };

  let remaining: number = milliseconds;

  for (const key of Object.values(DateDuration)) {
    const duration = key as DateDuration;
    const value = calculateCurrentDuration(remaining, duration);

    if (value < 1) continue;

    const floor = Math.floor(value);

    object[duration] = floor;

    remaining = remaining - calculateRemainingDuration(value, duration);
  }

  return object;
};

export const millisecondsDuration = millisecondsToDuration;
