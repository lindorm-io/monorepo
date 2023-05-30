import { DateDuration } from "../enums";

type Unit =
  | "Years"
  | "Year"
  | "Yrs"
  | "Yr"
  | "Y"
  | "Months"
  | "Month"
  | "Mo"
  | "Weeks"
  | "Week"
  | "W"
  | "Days"
  | "Day"
  | "D"
  | "Hours"
  | "Hour"
  | "Hrs"
  | "Hr"
  | "H"
  | "Minutes"
  | "Minute"
  | "Mins"
  | "Min"
  | "M"
  | "Seconds"
  | "Second"
  | "Secs"
  | "Sec"
  | "S"
  | "Milliseconds"
  | "Millisecond"
  | "Msecs"
  | "Msec"
  | "Ms";

type UnitAnyCase = Unit | Uppercase<Unit> | Lowercase<Unit>;

export type StringTimeValue = `${number}${UnitAnyCase}` | `${number} ${UnitAnyCase}`;

export type DurationObject = {
  [DateDuration.YEARS]: number;
  [DateDuration.MONTHS]: number;
  [DateDuration.WEEKS]: number;
  [DateDuration.DAYS]: number;
  [DateDuration.HOURS]: number;
  [DateDuration.MINUTES]: number;
  [DateDuration.SECONDS]: number;
  [DateDuration.MILLISECONDS]: number;
};

export type MatchString = {
  duration: DateDuration;
  number: number;
};
