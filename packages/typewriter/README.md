# @lindorm/typewriter

Generate TypeScript types (or Zod schemas) from JSON and YAML samples, via a CLI or a programmatic API.

## Installation

```bash
npm install @lindorm/typewriter
```

This package is **ESM-only**. All examples use `import` syntax; `require()` is not supported.

## Features

- Generate TypeScript interfaces from JSON or YAML files.
- Generate `typescript-zod` output as an alternative target.
- Accept individual files or whole directories as input (mixing `.json`, `.yml`, and `.yaml`).
- Combine multiple samples to widen inferred types.
- Optionally write the generated source to disk as `<name>.typewriter.ts`.
- Ships a `typewriter` CLI binary for use in scripts and `package.json` commands.

## CLI

After installing the package, the `typewriter` binary is available. Example:

```bash
npx typewriter --files ./schemas/user.json --name User --write ./src/generated
```

Files are emitted to `<write>/<PascalCaseName>.typewriter.ts`.

### CLI Options

| Flag                      | Description                                                                |
| ------------------------- | -------------------------------------------------------------------------- |
| `-f, --files <paths>`     | Comma-separated list of input file or directory paths. Required.           |
| `-n, --name <name>`       | Type name to generate. Pascal-cased automatically. Required.               |
| `-w, --write <directory>` | Directory to write the generated type into. Required.                      |
| `-o, --output <type>`     | Output target: `typescript` or `typescript-zod`. Defaults to `typescript`. |
| `-v, --verbose`           | Enable verbose logging. Defaults to `false`.                               |

Inputs may be:

- A `.json` file.
- A `.yml` or `.yaml` file.
- A directory containing any combination of the above (non-matching extensions are ignored).

## Programmatic Usage

```typescript
import { typewriter } from "@lindorm/typewriter";

const source = await typewriter({
  input: ["./schemas/user.json", "./schemas/extras"],
  typeName: "User",
  output: "typescript",
  writeToDirectory: "./src/generated",
});

console.log(source);
```

Calling `typewriter` without `writeToDirectory` returns the generated source as a string without touching the filesystem:

```typescript
import { typewriter } from "@lindorm/typewriter";

const source = await typewriter({
  input: ["./schemas/user.json"],
  typeName: "User",
});
```

You can also pass pre-loaded JSON sample strings directly through `samples`, which are merged with anything loaded from `input`:

```typescript
import { typewriter } from "@lindorm/typewriter";

const source = await typewriter({
  input: [],
  samples: [JSON.stringify({ id: "abc", count: 1 })],
  typeName: "Event",
});
```

## API

### `typewriter(options)`

```typescript
type Options = {
  fileName?: string;
  input: Array<string>;
  logger?: ILogger | LoggerOptions;
  output?: "typescript" | "typescript-zod";
  samples?: Array<string>;
  typeName: string;
  writeToDirectory?: string;
};

const typewriter: (options: Options) => Promise<string>;
```

Resolves with the generated source as a single string (lines joined with `\n`).

| Option             | Type                               | Description                                                                                                                                                                    |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `input`            | `Array<string>`                    | File or directory paths to read samples from. Each entry must exist; otherwise an error is thrown.                                                                             |
| `typeName`         | `string`                           | Name of the root type to emit.                                                                                                                                                 |
| `output`           | `"typescript" \| "typescript-zod"` | Target language. Defaults to `"typescript"`.                                                                                                                                   |
| `samples`          | `Array<string>`                    | Additional JSON-encoded samples merged with files loaded from `input`.                                                                                                         |
| `writeToDirectory` | `string`                           | If provided, the generated source is written to `<writeToDirectory>/<fileName ?? typeName>.typewriter.ts`. The directory is created if it does not exist.                      |
| `fileName`         | `string`                           | File name (without extension) for the written file. Defaults to `typeName`.                                                                                                    |
| `logger`           | `ILogger \| LoggerOptions`         | Either an existing `@lindorm/logger` instance (a child scoped to `Typewriter` is used) or options to construct a new one. Defaults to a fresh `Logger` scoped to `Typewriter`. |

## License

AGPL-3.0-or-later
