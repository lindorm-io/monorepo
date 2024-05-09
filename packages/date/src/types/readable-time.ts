type UnitLong =
  | "Years"
  | "Year"
  | "Yrs"
  | "Yr"
  | "Months"
  | "Month"
  | "Weeks"
  | "Week"
  | "Days"
  | "Day"
  | "Hours"
  | "Hour"
  | "Hrs"
  | "Hr"
  | "Minutes"
  | "Minute"
  | "Mins"
  | "Min"
  | "Seconds"
  | "Second"
  | "Secs"
  | "Sec"
  | "Milliseconds"
  | "Millisecond"
  | "Msecs"
  | "Msec";

type UnitShort = "Y" | "Mo" | "W" | "D" | "H" | "M" | "S" | "Ms";

type Unit = UnitLong | UnitShort;

type UnitAnyCase = Unit | Uppercase<Unit> | Lowercase<Unit>;

export type ReadableTime = `${number}${UnitAnyCase}` | `${number} ${UnitAnyCase}`;
