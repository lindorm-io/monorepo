import { DurationString } from "../../enums";
import { DurationDict } from "../../types";
import { _calculateCurrentDuration, calculateRemainingDuration } from "./calculate-duration";

export const _millisecondsToDuration = (milliseconds: number): DurationDict => {
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

  let remaining: number = milliseconds;

  for (const key of Object.values(DurationString)) {
    const duration = key as DurationString;
    const value = _calculateCurrentDuration(remaining, duration);

    if (value < 1) continue;

    const floor = Math.floor(value);

    object[duration] = floor;

    remaining = remaining - calculateRemainingDuration(value, duration);
  }

  return object;
};
