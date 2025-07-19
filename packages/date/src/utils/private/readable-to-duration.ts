import { DurationDict, ReadableTime } from "../../types";
import { matchString } from "./match-string";

export const readableToDuration = (...values: Array<ReadableTime>): DurationDict => {
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

  for (const string of values) {
    const { duration, number } = matchString(string);
    object[duration] += number;
  }

  return object;
};
