export const SECONDS = 1000;
export const MINUTES = SECONDS * 60;
export const HOURS = MINUTES * 60;
export const DAYS = HOURS * 24;
export const WEEKS = DAYS * 7;

// Gregorian calendar average: 97 leap years per 400 (not 100). Averaged over
// long spans this tracks real calendar years more closely than the Julian
// 365.25. Used only for estimation paths (ms/sec/millisecondsToReadable/
// millisecondsToDuration) where there is no reference date — calendar-correct
// paths route through date-fns instead.
export const YEARS = DAYS * 365.2425;
export const MONTHS = YEARS / 12;
