export const UNIT_LONG = [
  "Years",
  "Year",
  "Yrs",
  "Yr",
  "Months",
  "Month",
  "Weeks",
  "Week",
  "Days",
  "Day",
  "Hours",
  "Hour",
  "Hrs",
  "Hr",
  "Minutes",
  "Minute",
  "Mins",
  "Min",
  "Seconds",
  "Second",
  "Secs",
  "Sec",
  "Milliseconds",
  "Millisecond",
  "Msecs",
  "Msec",
] as const;

export const UNIT_SHORT = ["Y", "Mo", "W", "D", "H", "M", "S", "Ms"] as const;

export const UNIT_ANY_CASE = [
  ...UNIT_LONG,
  ...UNIT_SHORT,
  ...UNIT_LONG.map((unit) => unit.toUpperCase()),
  ...UNIT_LONG.map((unit) => unit.toLowerCase()),
  ...UNIT_SHORT.map((unit) => unit.toUpperCase()),
  ...UNIT_SHORT.map((unit) => unit.toLowerCase()),
] as const;

export type ReadableUnit = (typeof UNIT_ANY_CASE)[number];

export type ReadableTime = `${number}${ReadableUnit}` | `${number} ${ReadableUnit}`;
