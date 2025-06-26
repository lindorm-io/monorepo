# @lindorm/scanner

Recursive **file system scanner** that converts a directory tree into structured metadata and
optionally requires / imports the discovered modules.  Useful for building plugin systems, auto
registering routes, loading migrations, etc.

---

## Features

* Returns a rich `IScanData` object for every file / directory (path, name, types, children…)
* Configurable _deny lists_ (directories, extensions, filenames, file-type suffixes)
* Helper to **flatten** the hierarchical result into a one-dimensional array
* Convenience `require()` and dynamic `import()` wrappers

---

## Installation

```bash
npm install @lindorm/scanner
# or
yarn add @lindorm/scanner
```

---

## Quick example

```ts
import { Scanner } from '@lindorm/scanner';

const scanner = new Scanner({
  deniedDirectories: [/^\.git$/, /^node_modules$/],
  deniedExtensions: [/\.map$/],
  deniedFilenames: [/^test$/],
  deniedTypes: [/spec$/], // filters basename parts after first dot e.g. foo.controller.ts
});

const tree = scanner.scan(__dirname + '/routes');

console.log(Scanner.flatten(tree)); // array of files

// Require a specific module (returns whatever module.exports is)
const controller = scanner.require(tree.children[0]);

// Dynamic import (ESM)
const mod = await scanner.import(tree.children[0]);
```

---

## API

### `new Scanner(options?)`

```ts
type Options = {
  deniedDirectories?: RegExp[]; // base directory name rejection
  deniedExtensions?: RegExp[];  // extension rejection (without leading dot)
  deniedFilenames?: RegExp[];   // base filename rejection
  deniedTypes?: RegExp[];       // type segment rejection (basename split by dots)
  requireFn?: NodeRequire;      // override CommonJS require (for mocking)
};
```

### Instance methods

* `scan(path) → IScanData` – recursively scans path / file and returns root tree
* `require<IScanData | path>()` – CommonJS require helper
* `import<IScanData | path>()` – dynamic import (`Promise<any>`)

### Static helpers

* `Scanner.flatten(tree | tree[]) → IScanData[]` – depth-first flatten
* `Scanner.hasFiles(dir) → boolean` – checks synchronously if directory is non-empty

For full type definitions inspect `packages/scanner/src/interfaces`.

---

## TypeScript

Full typings included.  Runtime dependencies limited to Node built-ins (`fs`, `path`).

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

