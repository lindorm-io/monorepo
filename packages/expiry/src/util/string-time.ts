import { DateDuration } from "../enums";
import { DurationObject, MatchString, StringTimeValue } from "../types";

const seconds = 1000;
const minutes = seconds * 60;
const hours = minutes * 60;
const days = hours * 24;
const weeks = days * 7;
const months = days * 30.5;
const years = days * 365.25;

const regex =
  /^(?<value>(?:\d+)?\.?\d+) *(?<duration>years|year|yrs|yr|y|months|month|mo|weeks|week|w|days|day|d|hours|hour|hrs|hr|h|minutes|minute|mins|min|m|seconds|second|secs|sec|s|milliseconds|millisecond|msecs|msec|ms)?$/gi;

const getDuration = (string: string): DateDuration => {
  switch (string) {
    case "years":
    case "year":
    case "yrs":
    case "yr":
    case "y":
      return DateDuration.YEARS;

    case "months":
    case "month":
    case "mo":
      return DateDuration.MONTHS;

    case "weeks":
    case "week":
    case "w":
      return DateDuration.WEEKS;

    case "days":
    case "day":
    case "d":
      return DateDuration.DAYS;

    case "hours":
    case "hour":
    case "hrs":
    case "hr":
    case "h":
      return DateDuration.HOURS;

    case "minutes":
    case "minute":
    case "mins":
    case "min":
    case "m":
      return DateDuration.MINUTES;

    case "seconds":
    case "second":
    case "secs":
    case "sec":
    case "s":
      return DateDuration.SECONDS;

    case "milliseconds":
    case "millisecond":
    case "msecs":
    case "msec":
    case "ms":
      return DateDuration.MILLISECONDS;

    default:
      throw new Error(`Invalid string time value [ ${string} ]`);
  }
};

const matchString = (string: string): MatchString => {
  const result = new RegExp(regex).exec(string.toLowerCase());

  if (!result?.groups?.duration || !result?.groups?.value) {
    throw new Error(`Invalid string time value [ ${string} ]`);
  }

  const duration = getDuration(result.groups.duration);
  const number = parseInt(result.groups.value);

  return { duration, number };
};

export const stringDuration = (...values: Array<StringTimeValue>): DurationObject => {
  const object: Record<DateDuration, number> = {
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

export const stringMilliseconds = (...values: Array<StringTimeValue>): number => {
  const object = stringDuration(...values);
  let time = 0;

  time = time + object[DateDuration.MILLISECONDS];
  time = time + object[DateDuration.SECONDS] * seconds;
  time = time + object[DateDuration.MINUTES] * minutes;
  time = time + object[DateDuration.HOURS] * hours;
  time = time + object[DateDuration.DAYS] * days;
  time = time + object[DateDuration.WEEKS] * weeks;
  time = time + object[DateDuration.MONTHS] * months;
  time = time + object[DateDuration.YEARS] * years;

  return Math.round(time);
};

export const stringMs = stringMilliseconds;

export const stringSeconds = (...values: Array<StringTimeValue>): number =>
  Math.round(stringMilliseconds(...values) / 1000);
