# @lindorm-io/core

Core utilities and files for lindorm.io packages

## Installation

```shell script
npm install --save @lindorm-io/core
```

## Utilities

### base64

Fully unnecessary but quick utility to make base64 parsing a bit easier so that you don't have to remember.

```typescript
baseHash("string"); // -> "c3RyaW5n"
baseParse("c3RyaW5n"); // -> "string"
```

### case switch

Extending some of the lodash case switching functions to also include arrays and records.

```typescript
camelCase("snake_case"); // -> "snakeCase"
camelArray(["snake_case", "PascalCase"]); // -> ["snakeCase, pascalCase"]
camelKeys<Input, Output>({ snake_key: 123, PascalKey: true }); // -> { snakeKey: 123, pascalKey: true }

pascalCase("camelCase"); // -> "CamelCase"
pascalArray(["snake_case", "camelCase"]); // -> ["SnakeCase, CamelCase"]
pascalKeys<Input, Output>({ snake_key: 123, camelKey: true }); // -> { SnakeKey: 123, CamelKey: true }

pascalCase("PascalCase"); // -> "pascal_case"
pascalArray(["PascalCase", "camelCase"]); // -> ["pascal_case, camel_case"]
pascalKeys<Input, Output>({ PascalKey: 123, camelKey: true }); // -> { pascal_key: 123, camel_key: true }
```

### random value

```typescript
getRandomValue(12); // -> "rOjLkjjLFS2A"
getRandomNumber(6); // -> 703976
```

### sort object keys

```typescript
sortObjectKeys({ x: 3, a: 1, m: 2 }); // -> { a: 1, m: 2, x: 3 }
```

### strict typing

Extending some of the lodash typing to be stricter.

```typescript
isArrayStrict(["array"]); // -> true
isArrayStrict("string"); // -> false

isObjectStrict({ object: true }); // -> true
isObjectStrict(["array"]); // -> false
isObjectStrict(new Date()); // -> false
isObjectStrict(new Error()); // -> false
```

### string comparison

Timing safe string comparison. A stricter and safer comparison utility.

```typescript
stringComparison("string", "string"); // -> true
```

### string to time

Generating time data from strings. Useful for date-fns which can take duration objects

```typescript
stringToDurationObject("2 years 5 months"); // -> { years: 2, months: 5 }
stringToMilliseconds("12 seconds"); // -> 12000
stringToSeconds("5 minutes"); // -> 300000
```
