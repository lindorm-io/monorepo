import { DurationString } from "../../enums";
import { getDuration } from "./get-duration";

type MatchString = {
  duration: DurationString;
  number: number;
};

const REGEX =
  /^(?<value>(?:\d+)?\.?\d+) *(?<duration>years|year|yrs|yr|y|months|month|mo|weeks|week|w|days|day|d|hours|hour|hrs|hr|h|minutes|minute|mins|min|m|seconds|second|secs|sec|s|milliseconds|millisecond|msecs|msec|ms)?$/gi;

export const matchString = (string: string): MatchString => {
  const result = new RegExp(REGEX).exec(string.toLowerCase());

  if (!result?.groups?.duration || !result?.groups?.value) {
    throw new Error(`Invalid string time value [ ${string} ]`);
  }

  const duration = getDuration(result.groups.duration);
  const number = parseInt(result.groups.value);

  return { duration, number };
};
