# @lindorm/scanner

Recursive filesystem scanner that turns a directory tree into structured metadata and dynamically imports the discovered modules.

This package is **ESM-only**. All examples use `import`; `require` is not supported.

## Installation

```bash
npm install @lindorm/scanner
```

## Features

- Walks a directory tree synchronously and returns a hierarchical `IScanData` tree.
- Each node carries `baseName`, `basePath`, `extension`, `parents`, `relativePath`, `types`, and `children`.
- Splits a filename like `repo.controller.ts` into `baseName: "repo"`, `extension: "ts"`, `types: ["controller"]` (additional dot-separated segments become entries in `types`, ordered last-to-first).
- Filters traversal with regex deny lists for directories, extensions, filenames, and dot-separated type segments.
- Loads any scanned file via `import()`, normalising the returned namespace across runtimes (native ESM, tsx, vitest, ts-jest vm-modules) so consumers always see the user's real named and default exports.
- Falls back to `tsx/esm/api` when the host runtime cannot load a `.ts` file (e.g. Node without a loader, or a transformer that does not support TC39 stage-3 decorators).
- Static helpers to flatten the tree and check whether a directory contains entries.

## Usage

### Scan a directory

```ts
import { Scanner } from "@lindorm/scanner";

const scanner = new Scanner({
  deniedDirectories: [/^\.git$/, /^node_modules$/],
  deniedExtensions: [/^map$/],
  deniedFilenames: [/^index$/],
  deniedTypes: [/^test$/, /^spec$/],
});

const tree = scanner.scan(`${import.meta.dirname}/routes`);
const files = Scanner.flatten(tree);

for (const file of files) {
  console.log(file.relativePath, file.types);
}
```

### Import a scanned module

```ts
import { Scanner } from "@lindorm/scanner";

const scanner = new Scanner();
const tree = scanner.scan(`${import.meta.dirname}/plugins`);

const loadPlugin = async (file: { fullPath: string }) => {
  const mod = await scanner.import<{ default: unknown }>(file);
  return mod.default;
};

for (const file of Scanner.flatten(tree)) {
  if (file.extension !== "ts" && file.extension !== "js") continue;
  await loadPlugin(file);
}
```

`import` accepts either an `IScanData` node or an absolute path string. The returned object exposes the source module's exports directly — no `__esModule` or `module.exports` wrappers.

### Check whether a directory has any entries

```ts
import { Scanner } from "@lindorm/scanner";

if (Scanner.hasFiles(`${import.meta.dirname}/migrations`)) {
  // …
}
```

## API

### `class Scanner`

#### `new Scanner(options?: StructureScannerOptions)`

All options are optional. Each is an array of `RegExp` tested against the candidate string; a single match excludes the node.

| Option              | Tested against                                                       |
| ------------------- | -------------------------------------------------------------------- |
| `deniedDirectories` | The directory's `basename`.                                          |
| `deniedExtensions`  | The file extension without leading dot (e.g. `"ts"`, `"json"`).      |
| `deniedFilenames`   | The file's `baseName` (the segment before the first dot).            |
| `deniedTypes`       | Each dot-separated segment between the `baseName` and the extension. |

#### `scanner.scan(path: string): IScanData`

Synchronously walks `path`. Returns the root `IScanData` node. Throws `ScannerError("No files found")` if the root is filtered out by the configured deny lists.

#### `scanner.import<T>(fileOrPath: IScanData | string): Promise<T>`

Dynamically imports the file referenced by `fileOrPath.fullPath` (or the string path itself). Tries native `import()` first; if that throws `ERR_UNKNOWN_FILE_EXTENSION` or a `SyntaxError` on a `.ts`/`.tsx`/`.mts`/`.cts` file, retries via `tsx/esm/api`. The resolved value is the module's exports with any runtime-specific interop wrappers stripped.

#### `Scanner.flatten(scan: IScanData | Array<IScanData>): Array<IScanData>`

Static. Depth-first walk that returns every `isFile: true` descendant in a flat array. Directory nodes are dropped from the output.

#### `Scanner.hasFiles(directory: string): boolean`

Static. Returns `true` if `readdirSync(directory)` yields at least one entry. Returns `false` on any error (missing directory, permission denied, etc.).

### `class ScanData implements IScanData`

Plain data class. `new ScanData(options: IScanData)` copies every field from `options` onto the instance. The fields below match `IScanData`.

### `interface IScanData`

```ts
interface IScanData {
  baseName: string;
  basePath: string;
  children: Array<IScanData>;
  extension: string | null;
  fullName: string;
  fullPath: string;
  isDirectory: boolean;
  isFile: boolean;
  parents: Array<string>;
  relativePath: string;
  types: Array<string>;
}
```

For `repo.controller.ts` scanned from a root that contains it under `src/users/`, the values are: `baseName: "repo"`, `basePath: "src/users/repo.controller"`, `extension: "ts"`, `fullName: "repo.controller.ts"`, `parents: ["src", "users"]`, `relativePath: "src/users/repo.controller.ts"`, `types: ["controller"]`.

### `interface IScanner`

```ts
interface IScanner {
  scan(path: string): IScanData;
  import<T>(fileOrPath: IScanData | string): Promise<T>;
}
```

### `type StructureScannerConfig` / `type StructureScannerOptions`

```ts
type StructureScannerConfig = {
  deniedDirectories: Array<RegExp>;
  deniedExtensions: Array<RegExp>;
  deniedFilenames: Array<RegExp>;
  deniedTypes: Array<RegExp>;
};

type StructureScannerOptions = Partial<StructureScannerConfig>;
```

### `class ScannerError extends LindormError`

Thrown by `scan` when no files match. Inherits from `@lindorm/errors`'s `LindormError`.

## License

AGPL-3.0-or-later.
