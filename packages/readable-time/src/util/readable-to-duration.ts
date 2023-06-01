import { DateDuration } from "../enums";
import { DurationDictionary, ReadableTime } from "../types";
import { matchString } from "./private";

export const readableToDuration = (...values: Array<ReadableTime>): DurationDictionary => {
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

  for (const string of values) {
    const { duration, number } = matchString(string);
    object[duration] += number;
  }

  return object;
};

export const readableDuration = readableToDuration;
