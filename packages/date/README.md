# @lindorm/date

A lindorm-flavoured wrapper around [date-fns](https://date-fns.org/) that
accepts human-readable time strings (`"10 minutes"`, `"2h"`, `"25 years"`)
everywhere and re-exports all of date-fns.

## Installation

```bash
npm install @lindorm/date
```

## Quick Start

```ts
import { expiresAt, ms, duration } from "@lindorm/date";

// Absolute expiry 25 years from now — calendar-correct via date-fns
const deadline = expiresAt("25 years");

// Millisecond count (estimated using a Gregorian-year average)
ms("2 hours"); // 7200000
ms(5000); // "5s"

// Duration dict from a readable string (exact) or a ms count (bucketised)
duration("1y 6mo");
// { years: 1, months: 6, weeks: 0, days: 0,
//   hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }
```

## Calendar vs estimation

`ReadableTime` is the single input type — it accepts every unit from
milliseconds up to years in long, short, and abbreviated forms. The package
honours that input in two different ways depending on what it knows:

- **Calendar-correct** (via date-fns `add()`): `expiresAt`, `expiresIn`,
  `expires`, `readableToDuration` + `addWithMilliseconds`. These have a
  reference date to anchor to, so `"1 year"` means "the same calendar day
  next year" regardless of leap years, and `"1 month"` means "the same day
  of next month" regardless of month length.

- **Estimation** (constant-based): `ms`, `sec`, `millisecondsToReadable`,
  `millisecondsToDuration`. These have no reference date, so year and month
  values are computed using a Gregorian-calendar average of **365.2425 days
  per year** (year / 12 per month). This tracks real calendar years more
  closely than the Julian 365.25 over long spans.

Both forms accept the full `ReadableTime` surface including year and month
units. When you have a reference date available, prefer the calendar-correct
functions; when you only need a millisecond count for a timeout or TTL, the
estimation functions are fine.

The estimation inverse (`ms(number)`, `duration(number)`) uses coarse
matching: values that are within a small tolerance of a clean integer in a
larger unit are normalised to that unit, so `ms(readableToMilliseconds("25
years"))` round-trips to `"25y"` cleanly.

## API reference

### Time conversion

#### `ms(value)`

Convert between `ReadableTime` and a millisecond count.

```ts
ms("2s"); // 2000
ms("5 minutes"); // 300000
ms("1 day"); // 86400000
ms(60000); // "1m"
ms(3600000); // "1h"
```

#### `sec(value)`

Convert between `ReadableTime` and a second count.

```ts
sec("30s"); // 30
sec("5 minutes"); // 300
sec(60); // "1m"
sec(86400); // "1d"
```

#### `duration(value)`

Convert between `ReadableTime` and a `DurationDict`.

```ts
duration("1d 2h");
// { years: 0, months: 0, weeks: 0, days: 1,
//   hours: 2, minutes: 0, seconds: 0, milliseconds: 0 }

duration(93784000);
// { years: 0, months: 0, weeks: 0, days: 1,
//   hours: 2, minutes: 3, seconds: 4, milliseconds: 0 }
```

### Expiration

#### `expiresAt(expiry, from?)`

Returns the absolute expiration `Date`. Calendar-correct for year/month.

```ts
expiresAt("30 minutes"); // Date 30 minutes from now
expiresAt("25 years"); // Same calendar day, 25 years from now
expiresAt(new Date("2026-01-01"));
```

Throws if a passed `Date` is in the past.

#### `expiresIn(expiry, from?)`

Returns seconds until expiration. Calendar-correct.

```ts
expiresIn("10 minutes"); // 600
expiresIn("1 hour"); // 3600
```

#### `expires(expiry, from?)`

Returns the full expiry bundle.

```ts
const exp = expires("30 minutes");
// {
//   expiresAt: Date,       // absolute expiration
//   expiresIn: 1800,       // seconds until expiration
//   expiresOn: 1234567890, // unix timestamp of expiration
//   from: Date,            // reference date (now)
//   fromUnix: 1234566090,  // unix timestamp of reference
// }
```

### Type guards

#### `isReadableTime(value)`

```ts
isReadableTime("10 minutes"); // true
isReadableTime("2.5 hours"); // true
isReadableTime("invalid"); // false
```

## ReadableTime format

| Unit         | Long form                 | Abbreviated | Short |
| ------------ | ------------------------- | ----------- | ----- |
| Years        | years, year               | yrs, yr     | y     |
| Months       | months, month             | —           | mo    |
| Weeks        | weeks, week               | —           | w     |
| Days         | days, day                 | —           | d     |
| Hours        | hours, hour               | hrs, hr     | h     |
| Minutes      | minutes, minute           | mins, min   | m     |
| Seconds      | seconds, second           | secs, sec   | s     |
| Milliseconds | milliseconds, millisecond | msecs, msec | ms    |

All unit forms are case-insensitive and the space between number and unit is
optional:

```ts
"5s"; // short, no space
"5 s"; // short, space
"5 seconds"; // long
"5 Seconds"; // mixed case
"5 SECONDS"; // upper case
"2 hours 30 minutes"; // multiple units
```

## Classes

### `TtlMap<K, V>`

A `Map` with per-entry TTL. Entries expire after their TTL elapses and are
cleaned up lazily on read.

```ts
import { TtlMap } from "@lindorm/date";

const cache = new TtlMap<string, number>("5m"); // default TTL
cache.set("a", 42); // uses default TTL
cache.set("b", 99, "30s"); // per-entry override
cache.get("a"); // 42
// ...5 minutes later
cache.get("a"); // undefined
```

### `TtlSet<V>`

Set equivalent — members expire after their TTL.

```ts
import { TtlSet } from "@lindorm/date";

const seen = new TtlSet<string>("1h");
seen.add("nonce");
seen.has("nonce"); // true
```

## date-fns re-export

This package re-exports everything from `date-fns`, so you can import both
lindorm helpers and raw date-fns from the same module:

```ts
import { expiresAt, addDays, format, parseISO } from "@lindorm/date";
```

## License

AGPL-3.0-or-later
