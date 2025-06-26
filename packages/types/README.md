# @lindorm/types

Shared **type utilities and common interfaces** used across the Lindorm monorepo.  The package does
not contain any executable code and therefore adds _zero_ runtime overhead to your project.  It is
published separately so downstream packages can depend on a single source of truth for complex
generics and enums.

---

## Installation

```bash
npm install @lindorm/types
# or
yarn add @lindorm/types
```

Because the package only contains declaration files and re-exports there is nothing to transpile –
your bundler will simply ignore it at runtime.

---

## Overview of exported symbols (excerpt)

• **Utility generics**: `DeepPartial<T>`, `Dict<T>`, `Mutable<T>`, `NoUndefined<T>` …
• **Common enums**: `ShaAlgorithm`, `KeyUse`, `DsaEncoding` …
• **Crypto interfaces**: `IKeyKit`, `IKryptos*` re-exports, `KeyData`
• **Predicate helpers**: `Predicate<T>` used by repository drivers

Refer to the source files in `packages/types/src` for the complete list.

---

## Semantic versioning

While the package follows SemVer, **breaking type changes** may occur more frequently than in
runtime libraries.  Always consult the changelog before upgrading in libraries that rely heavily on
these generics.

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

