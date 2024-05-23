import { DurationString } from "../../enums";
import { DurationDict, ReadableTime } from "../../types";
import { matchString } from "./match-string";

export const readableToDuration = (...values: Array<ReadableTime>): DurationDict => {
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

  for (const string of values) {
    const { duration, number } = matchString(string);
    object[duration] += number;
  }

  return object;
};
