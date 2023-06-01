import { DateDuration } from "../enums";

export type DurationDictionary = Record<DateDuration, number>;

export type MatchString = {
  duration: DateDuration;
  number: number;
};
