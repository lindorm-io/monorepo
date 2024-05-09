import { DurationString } from "../../enums";
import { DurationDict, ReadableTime } from "../../types";
import { _matchString } from "./match-string";

export const _readableToDuration = (...values: Array<ReadableTime>): DurationDict => {
  const object: DurationDict = {
    [DurationString.YEARS]: 0,
    [DurationString.MONTHS]: 0,
    [DurationString.WEEKS]: 0,
    [DurationString.DAYS]: 0,
    [DurationString.HOURS]: 0,
    [DurationString.MINUTES]: 0,
    [DurationString.SECONDS]: 0,
    [DurationString.MILLISECONDS]: 0,
  };

  for (const string of values) {
    const { duration, number } = _matchString(string);
    object[duration] += number;
  }

  return object;
};
