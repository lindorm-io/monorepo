import { isFinite } from "lodash";

enum Duration {
  YEARS = "years",
  MONTHS = "months",
  DAYS = "days",
  HOURS = "hours",
  MINUTES = "minutes",
  SECONDS = "seconds",
  MILLISECONDS = "milliseconds",
}

type DurationObject = {
  [Duration.YEARS]: number;
  [Duration.MONTHS]: number;
  [Duration.DAYS]: number;
  [Duration.HOURS]: number;
  [Duration.MINUTES]: number;
  [Duration.SECONDS]: number;
  [Duration.MILLISECONDS]: number;
};

type RegExpObject = Record<Duration, RegExp>;

const regexp: RegExpObject = {
  [Duration.YEARS]: /(\d+ years)/g,
  [Duration.MONTHS]: /(\d+ months)/g,
  [Duration.DAYS]: /(\d+ days)/g,
  [Duration.HOURS]: /(\d+ hours)/g,
  [Duration.MINUTES]: /(\d+ minutes)/g,
  [Duration.SECONDS]: /(\d+ seconds)/g,
  [Duration.MILLISECONDS]: /(\d+ milliseconds)/g,
};

const getNumber = (string: string, regex: RegExp): number => {
  try {
    const result = string.toLowerCase().match(regex);

    if (!result || !result.length || result.length > 1) {
      return 0;
    }

    const number = parseInt(result[0].replace(/\s+/g, ""));

    if (!isFinite(number)) {
      return 0;
    }

    return number;
  } catch (_) {
    return 0;
  }
};

export const stringToDurationObject = (string: string): DurationObject => {
  const object: Record<Duration, number> = {
    [Duration.YEARS]: 0,
    [Duration.MONTHS]: 0,
    [Duration.DAYS]: 0,
    [Duration.HOURS]: 0,
    [Duration.MINUTES]: 0,
    [Duration.SECONDS]: 0,
    [Duration.MILLISECONDS]: 0,
  };

  for (const key of Object.keys(regexp)) {
    object[key as Duration] = getNumber(string, regexp[key as Duration]);
  }

  return object;
};

export const stringToMilliseconds = (string: string): number => {
  const object = stringToDurationObject(string);
  let time = 0;

  time = time + object[Duration.MILLISECONDS];
  time = time + object[Duration.SECONDS] * 1000;
  time = time + object[Duration.MINUTES] * 60 * 1000;
  time = time + object[Duration.HOURS] * 60 * 60 * 1000;
  time = time + object[Duration.DAYS] * 24 * 60 * 60 * 1000;
  time = time + object[Duration.MONTHS] * 30 * 24 * 60 * 60 * 1000;
  time = time + object[Duration.YEARS] * 365 * 24 * 60 * 60 * 1000;

  return time;
};

export const stringToSeconds = (string: string): number => {
  return Math.round(stringToMilliseconds(string) / 1000);
};
