# @lindorm/date

A lindorm-flavoured wrapper around [date-fns](https://date-fns.org/) that parses human-readable time strings (`"10 minutes"`, `"2h"`, `"25 years"`), exposes calendar-correct expiry helpers, and ships TTL-aware `Map` / `Set` containers.

## Installation

```bash
npm install @lindorm/date
```

This package is **ESM-only**. It cannot be `require()`'d from CommonJS.

## Features

- `ReadableTime` parser covering long, abbreviated, and short unit forms (case-insensitive, whitespace-optional).
- Calendar-correct expiry helpers (`expiresAt`, `expiresIn`, `expires`) backed by date-fns `add()` — real calendar days for year and month units.
- Estimation helpers (`ms`, `sec`, `duration`) that convert in either direction without a reference date, using a Gregorian-year average for year and month units.
- `TtlMap<K, V>` and `TtlSet<T>` — lazy-expiring container types with per-entry TTL overrides.
- `isReadableTime` type guard.
- Re-exports the entire `date-fns` API from the same module entry point.

## Quick start

```ts
import { duration, expiresAt, ms } from "@lindorm/date";

const deadline = expiresAt("25 years");

ms("2 hours");
ms(5000);

duration("6mo");
```

## ReadableTime format

A `ReadableTime` is a single `<integer><unit>` token, optionally separated by one space. The full unit table:

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

Unit forms are case-insensitive. Examples that all parse equivalently:

```ts
"5s";
"5 s";
"5 seconds";
"5 SECONDS";
"5 Seconds";
```

A `ReadableTime` describes **one** unit-quantity pair — `"1d 2h"` and other compound forms are not accepted by the public string-parsing helpers and will throw. `isReadableTime` only accepts integer values; `1.5h` is not a valid `ReadableTime`.

## Calendar vs estimation

The package resolves `ReadableTime` two different ways, depending on whether a reference date is available:

- **Calendar-correct** (`expiresAt`, `expiresIn`, `expires`): year and month units delegate to date-fns `add()`. `"1 year"` lands on the same calendar day next year regardless of leap years; `"1 month"` lands on the same day-of-month next month, snapping back when the target month is shorter (e.g. Jan 31 + 1 month → Feb 29 in a leap year).
- **Estimation** (`ms`, `sec`, `duration`): no reference date, so year and month units are computed from a Gregorian-year average of **365.2425 days per year** (year / 12 per month). Smaller units are exact.

When you have a reference date and need correctness against the real calendar, prefer the expiry helpers. When you only need a millisecond or second count for a timeout or TTL, the estimation helpers are sufficient.

The estimation inverse (`ms(number)`, `duration(number)`) uses coarse matching: values within a tolerance of an integer multiple of a larger unit are normalised to that unit, so feeding `ms("25y")` back through `ms()` returns `"25y"` instead of an ms-suffixed residual.

## API

### Time conversion

#### `ms(value)`

Convert between a `ReadableTime` and a millisecond count.

```ts
ms("2s");
ms("5 minutes");
ms("1 day");
ms(60000);
ms(3600000);
```

Signatures: `ms(readable: ReadableTime): number` and `ms(milliseconds: number): ReadableTime`.

#### `sec(value)`

Convert between a `ReadableTime` and a second count.

```ts
sec("30s");
sec("5 minutes");
sec(60);
sec(86400);
```

Signatures: `sec(readable: ReadableTime): number` and `sec(seconds: number): ReadableTime`.

#### `duration(value)`

Convert between a `ReadableTime` and a `DurationDict` (a `Record<DurationString, number>` covering `years`, `months`, `weeks`, `days`, `hours`, `minutes`, `seconds`, `milliseconds`).

```ts
duration("6mo");
duration(93784000);
```

Signatures: `duration(readable: ReadableTime): DurationDict` and `duration(milliseconds: number): DurationDict`.

### Expiration

#### `expiresAt(expiry, from?)`

Resolve an `Expiry` (a `ReadableTime` string or a `Date`) to an absolute `Date`. When `expiry` is a `Date`, it is returned unchanged after a future-date assertion. Calendar-correct for year and month units.

```ts
const at = expiresAt("30 minutes");
const fixed = expiresAt(new Date("2099-01-01"));
```

Throws `Error("Invalid expiry: Expiry is before current date")` when a `Date` expiry is not strictly after `from`. Throws `Error("Invalid expiry: Expiry is not of type [ string | Date ]")` for any other input.

#### `expiresIn(expiry, from?)`

Seconds from `from` (default `new Date()`) until the resolved `Expiry`. Calendar-correct.

```ts
expiresIn("10 minutes");
expiresIn("1 hour");
```

#### `expires(expiry, from?)`

Full expiry bundle:

```ts
const exp = expires("30 minutes");
// {
//   expiresAt: Date,
//   expiresIn: number,        // seconds from `from` to `expiresAt`
//   expiresOn: number,        // unix seconds of `expiresAt`
//   from: Date,
//   fromUnix: number,         // unix seconds of `from`
// }
```

### Type guard

#### `isReadableTime(value)`

Returns `true` for an integer `ReadableTime` token, `false` otherwise.

```ts
isReadableTime("10 minutes");
isReadableTime("2h");
isReadableTime("invalid");
```

### Containers

#### `TtlMap<K, V>`

A `Map`-like container where every entry has its own expiry timestamp. Entries are evicted lazily — the next read after the entry's TTL elapses removes it. Construct with a default `ReadableTime` TTL applied to inserts that do not pass an override.

```ts
import { TtlMap } from "@lindorm/date";

const cache = new TtlMap<string, number>("5m");

cache.set("a", 1);
cache.set("b", 2, "30s");

cache.get("a");
cache.has("b");
cache.delete("a");
cache.cleanup();
cache.clear();

for (const [key, value] of cache) {
  // ...
}
```

Methods: `set(key, value, ttl?)`, `get(key)`, `has(key)`, `delete(key)`, `clear()`, `cleanup()`, `forEach(cb, thisArg?)`, `keys()`, `values()`, `entries()`, `[Symbol.iterator]()`. The `size` getter calls `cleanup()` first so it returns the live count. `set` returns `this` for chaining. Per-entry `ttl` accepts the full `Expiry` type — a `ReadableTime` string or an absolute `Date`.

#### `TtlSet<T>`

Set-shaped equivalent of `TtlMap` — members expire after their TTL.

```ts
import { TtlSet } from "@lindorm/date";

const seen = new TtlSet<string>("1h");

seen.add("nonce");
seen.has("nonce");
seen.delete("nonce");
```

Methods: `add(value, ttl?)`, `has(value)`, `delete(value)`, `clear()`, `cleanup()`, `forEach(cb, thisArg?)`, `keys()`, `values()`, `entries()`, `[Symbol.iterator]()`. Same lazy-eviction and `size` semantics as `TtlMap`.

### Types

| Name             | Description                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `ReadableTime`   | Template-literal type for `<integer><unit>` and `<integer> <unit>` tokens.                         |
| `ReadableUnit`   | Union of every accepted unit form.                                                                 |
| `Expiry`         | `ReadableTime \| Date` — the input type accepted by all expiry helpers.                            |
| `DurationDict`   | `Record<DurationString, number>` — the shape returned by `duration()`.                             |
| `DurationString` | `"years" \| "months" \| "weeks" \| "days" \| "hours" \| "minutes" \| "seconds" \| "milliseconds"`. |

The constants `UNIT_LONG`, `UNIT_SHORT`, and `UNIT_ANY_CASE` (the union backing `ReadableUnit`) are also exported.

## date-fns re-export

The package re-exports the entire `date-fns` surface, so lindorm helpers and raw date-fns can be imported from one module:

```ts
import { addDays, expiresAt, format, parseISO } from "@lindorm/date";
```

## License

AGPL-3.0-or-later
