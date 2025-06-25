# @lindorm/case

Comprehensive string case conversion utilities for JavaScript/TypeScript applications.

## Installation

```bash
npm install @lindorm/case
```

## Features

- Convert strings between 11 different case conventions
- Transform object keys to any case convention
- Handle arrays of strings or objects
- Full TypeScript support with type safety
- Zero external dependencies (except `@lindorm/is` for type checking)

## Supported Case Types

- **camelCase** - camelCaseExample
- **Capital Case** - Capital Case Example
- **CONSTANT_CASE** - CONSTANT_CASE_EXAMPLE
- **dot.case** - dot.case.example
- **Header-Case** - Header-Case-Example
- **kebab-case** - kebab-case-example
- **lower case** - lower case example
- **PascalCase** - PascalCaseExample
- **path/case** - path/case/example
- **Sentence case** - Sentence case example
- **snake_case** - snake_case_example

## Usage

### Basic String Conversion

```typescript
import { camelCase, snakeCase, pascalCase } from "@lindorm/case";

camelCase("Hello World");      // "helloWorld"
snakeCase("Hello World");      // "hello_world"
pascalCase("hello-world");     // "HelloWorld"
```

### Converting Object Keys

```typescript
import { camelKeys, snakeKeys } from "@lindorm/case";

const input = {
  "first-name": "John",
  "last-name": "Doe",
  "contact-info": {
    "phone-number": "123-456-7890"
  }
};

camelKeys(input);
// {
//   firstName: "John",
//   lastName: "Doe",
//   contactInfo: {
//     phoneNumber: "123-456-7890"
//   }
// }

snakeKeys(input);
// {
//   first_name: "John",
//   last_name: "Doe",
//   contact_info: {
//     phone_number: "123-456-7890"
//   }
// }
```

### Converting Arrays

```typescript
import { camelArray, snakeArray } from "@lindorm/case";

camelArray(["first-name", "last-name"]);     // ["firstName", "lastName"]
snakeArray(["firstName", "lastName"]);       // ["first_name", "last_name"]
```

### Generic Conversion Functions

Use the `changeCase` and `changeKeys` functions with the `ChangeCase` enum for dynamic case selection:

```typescript
import { changeCase, changeKeys, ChangeCase } from "@lindorm/case";

const caseType = ChangeCase.Pascal;

changeCase("hello-world", caseType);          // "HelloWorld"
changeCase("hello-world", ChangeCase.Snake); // "hello_world"

const obj = { "first-name": "John" };
changeKeys(obj, ChangeCase.Camel);           // { firstName: "John" }
```

## API Reference

### Individual Case Functions

Each case type exports three functions:

- `{case}Case(input: string): string` - Convert a string
- `{case}Keys(input: object | object[]): object | object[]` - Convert object keys
- `{case}Array(input: string[]): string[]` - Convert array of strings

Available for: camel, capital, constant, dot, header, kebab, lower, pascal, path, sentence, snake

### Generic Functions

- `changeCase(input: string, changeCase: ChangeCase): string`
- `changeKeys(input: object | object[], changeCase: ChangeCase): object | object[]`

### Enums

- `ChangeCase` - Enum containing all case types (Camel, Capital, Constant, Dot, Header, Kebab, Lower, Pascal, Path, Sentence, Snake, None)

## Examples

### API Response Transformation

```typescript
import { camelKeys } from "@lindorm/case";

// Transform API response from snake_case to camelCase
const apiResponse = {
  user_id: "123",
  first_name: "John",
  last_name: "Doe",
  created_at: "2023-01-01"
};

const transformed = camelKeys(apiResponse);
// {
//   userId: "123",
//   firstName: "John",
//   lastName: "Doe",
//   createdAt: "2023-01-01"
// }
```

### Database Field Mapping

```typescript
import { snakeKeys } from "@lindorm/case";

// Convert JavaScript object to database format
const userModel = {
  userId: "123",
  firstName: "John",
  lastName: "Doe",
  createdAt: new Date()
};

const dbRecord = snakeKeys(userModel);
// {
//   user_id: "123",
//   first_name: "John",
//   last_name: "Doe",
//   created_at: Date object
// }
```

## Error Handling

All functions validate input types and will throw an error if a non-string value is passed to string conversion functions:

```typescript
import { camelCase } from "@lindorm/case";

camelCase(123);        // Throws Error
camelCase(null);       // Throws Error
camelCase(undefined);  // Throws Error
```

## License

AGPL-3.0-or-later
