# @lindorm/date

Comprehensive date/time utilities with human-readable duration parsing, expiration handling, and full date-fns integration.

## Installation

```bash
npm install @lindorm/date
```

## Features

- **Human-Readable Time**: Parse and format durations like "10 minutes", "2h", "30s"
- **Bidirectional Converters**: Functions work both ways (ms to readable, readable to ms)
- **Expiration Management**: Handle expiry dates with multiple representations
- **Duration Objects**: Break down time into years, months, days, hours, etc.
- **Type-Safe**: Full TypeScript support with strict typing
- **date-fns Integration**: Re-exports all date-fns functions
- **Flexible Input**: Multiple unit formats, case-insensitive, with/without spaces

## Quick Start

```typescript
import { ms, sec, duration, expires } from "@lindorm/date";

// Convert between milliseconds and readable time
ms("2 hours");          // 7200000
ms(5000);              // "5s"

// Convert between seconds and readable time  
sec("10 minutes");      // 600
sec(30);               // "30s"

// Parse durations
duration(3661000);     // { hours: 1, minutes: 1, seconds: 1 }
duration("2h 30m");    // { hours: 2, minutes: 30 }

// Handle expiration
const exp = expires("1 hour");
// {
//   expiresAt: Date,     // 1 hour from now
//   expiresIn: 3600,     // seconds
//   expiresOn: 1234567890, // Unix timestamp
//   from: Date,          // Current time
//   fromUnix: 1234564290 // Current Unix timestamp
// }
```

## API Reference

### Time Conversion

#### `ms(value)`
Converts between milliseconds and readable time strings.

```typescript
// String to milliseconds
ms("100");              // 100
ms("2s");               // 2000
ms("5 minutes");        // 300000
ms("1.5h");            // 5400000
ms("1 day");           // 86400000

// Milliseconds to string
ms(60000);             // "1m"
ms(3600000);           // "1h"
ms(90000);             // "1m"
ms(5400000);           // "1h"
```

#### `sec(value)`
Converts between seconds and readable time strings.

```typescript
// String to seconds
sec("30s");             // 30
sec("5 minutes");       // 300
sec("2 hours");         // 7200
sec("1 day");          // 86400

// Seconds to string
sec(60);               // "1m"
sec(3600);             // "1h"
sec(86400);            // "1d"
```

### Duration Handling

#### `duration(value)`
Converts milliseconds or readable time to a duration object.

```typescript
// Milliseconds to duration object
duration(93784000);
// {
//   days: 1,
//   hours: 2,
//   minutes: 3,
//   seconds: 4
// }

// Readable time to duration object
duration("1 year 2 months");
// {
//   years: 1,
//   months: 2
// }

// Single unit
duration("48h");
// {
//   hours: 48
// }
```

### Readable Time Formats

#### Supported Units

| Unit | Long Form | Abbreviated | Short |
|------|-----------|-------------|-------|
| Years | years, year | yrs, yr | y |
| Months | months, month | - | mo |
| Weeks | weeks, week | - | w |
| Days | days, day | - | d |
| Hours | hours, hour | hrs, hr | h |
| Minutes | minutes, minute | mins, min | m |
| Seconds | seconds, second | secs, sec | s |
| Milliseconds | milliseconds, millisecond | msecs, msec | ms |

#### Format Examples

```typescript
// All these are valid:
"5s"                    // 5 seconds
"5 s"                   // with space
"5 seconds"             // long form
"5 Seconds"             // case-insensitive
"5 SECONDS"             // all caps
"2.5h"                  // decimals
"2 hours 30 minutes"   // multiple units
```

#### `isReadableTime(value)`
Type guard to check if a string is valid readable time.

```typescript
isReadableTime("10 minutes");  // true
isReadableTime("invalid");     // false
isReadableTime("2.5 hours");   // true
isReadableTime("");            // false
```

### Expiration Handling

#### `expiresAt(expiry)`
Returns the absolute expiration date.

```typescript
// From readable time (relative to now)
expiresAt("30 minutes");       // Date 30 minutes from now
expiresAt("1h");               // Date 1 hour from now

// From Date object
const futureDate = new Date("2025-01-01");
expiresAt(futureDate);         // Returns the same Date

// Throws error if date is in the past
const pastDate = new Date("2020-01-01");
expiresAt(pastDate);           // Throws Error
```

#### `expiresIn(expiry)`
Returns seconds until expiration.

```typescript
expiresIn("10 minutes");       // 600
expiresIn("1 hour");           // 3600
expiresIn("1d");               // 86400

const futureDate = new Date(Date.now() + 60000);
expiresIn(futureDate);         // ~60
```

#### `expires(expiry)`
Returns comprehensive expiration information.

```typescript
const exp = expires("30 minutes");
// {
//   expiresAt: Date,          // Absolute expiration date
//   expiresIn: 1800,          // Seconds until expiration
//   expiresOn: 1234567890,    // Unix timestamp of expiration
//   from: Date,               // Reference date (now)
//   fromUnix: 1234566090      // Unix timestamp of reference
// }

// With a specific date
const futureDate = new Date("2025-01-01T00:00:00Z");
const exp2 = expires(futureDate);
```

### Types

#### `DurationString`
Enum of available duration units.

```typescript
enum DurationString {
  Years = "years",
  Months = "months",
  Weeks = "weeks",
  Days = "days",
  Hours = "hours",
  Minutes = "minutes",
  Seconds = "seconds",
  Milliseconds = "milliseconds"
}
```

#### `DurationDict`
Object representing a duration broken down by units.

```typescript
type DurationDict = {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
}
```

#### `ReadableTime`
Type-safe string format for readable time.

```typescript
type ReadableTime = string; // e.g., "5s", "10 minutes", "2h"
```

#### `Expiry`
Union type for expiration values.

```typescript
type Expiry = ReadableTime | Date;
```

## Advanced Examples

### Working with Durations

```typescript
import { duration, ms } from "@lindorm/date";

// Convert complex duration to milliseconds
const complexDuration = duration("1d 2h 30m");
const totalMs = 
  (complexDuration.days || 0) * 24 * 60 * 60 * 1000 +
  (complexDuration.hours || 0) * 60 * 60 * 1000 +
  (complexDuration.minutes || 0) * 60 * 1000;

// Parse user input
function parseUserTimeout(input: string): number {
  if (isReadableTime(input)) {
    return ms(input);
  }
  throw new Error("Invalid timeout format");
}
```

### Token Expiration

```typescript
import { expires, expiresIn } from "@lindorm/date";

interface Token {
  value: string;
  expiresAt: Date;
}

function createToken(ttl: ReadableTime): Token {
  const exp = expires(ttl);
  
  return {
    value: generateTokenValue(),
    expiresAt: exp.expiresAt
  };
}

function isTokenValid(token: Token): boolean {
  try {
    const secondsRemaining = expiresIn(token.expiresAt);
    return secondsRemaining > 0;
  } catch {
    // Token is expired
    return false;
  }
}
```

### Cache TTL Management

```typescript
import { ms, expires } from "@lindorm/date";

class Cache<T> {
  private store = new Map<string, { value: T; expiresAt: Date }>();

  set(key: string, value: T, ttl: ReadableTime = "5m"): void {
    const exp = expires(ttl);
    this.store.set(key, {
      value,
      expiresAt: exp.expiresAt
    });
  }

  get(key: string): T | undefined {
    const item = this.store.get(key);
    if (!item) return undefined;

    try {
      expiresIn(item.expiresAt); // Throws if expired
      return item.value;
    } catch {
      this.store.delete(key);
      return undefined;
    }
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (item.expiresAt.getTime() < now) {
        this.store.delete(key);
      }
    }
  }
}
```

### Configuration with Durations

```typescript
import { duration, ms } from "@lindorm/date";
import { z } from "zod";

// Configuration schema with readable time
const configSchema = z.object({
  server: z.object({
    timeout: z.string().refine(isReadableTime),
    keepAlive: z.string().refine(isReadableTime),
  }),
  cache: z.object({
    defaultTTL: z.string().refine(isReadableTime),
    maxAge: z.string().refine(isReadableTime),
  }),
});

// Use in application
const config = configSchema.parse({
  server: {
    timeout: "30s",
    keepAlive: "5m",
  },
  cache: {
    defaultTTL: "1h",
    maxAge: "24h",
  },
});

// Convert to milliseconds when needed
const serverTimeout = ms(config.server.timeout);
const cacheMaxAge = ms(config.cache.maxAge);
```

## date-fns Integration

This package re-exports all functions from date-fns:

```typescript
import { 
  format, 
  addDays, 
  differenceInDays, 
  parseISO 
} from "@lindorm/date";

// Use date-fns functions
const tomorrow = addDays(new Date(), 1);
const formatted = format(tomorrow, "yyyy-MM-dd");
const diff = differenceInDays(tomorrow, new Date());
```

## Error Handling

Functions throw errors for invalid inputs:

```typescript
try {
  ms("invalid");           // Throws Error
  expiresAt(new Date(0)); // Throws Error (date in past)
  duration("not a time"); // Throws Error
} catch (error) {
  console.error("Invalid time format:", error.message);
}
```

## Time Calculation Notes

- **Year**: Calculated as 365.25 days for accuracy
- **Month**: Calculated as year/12 (approximately 30.44 days)
- **Week**: Exactly 7 days
- **Day**: Exactly 24 hours
- **All calculations maintain millisecond precision**

## License

AGPL-3.0-or-later
