# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.2.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/zephyr@0.2.0...@lindorm/zephyr@0.2.1) (2026-05-05)

### Bug Fixes

- **packages:** declare files: ["dist"] for every publishable package ([6fe2ac8](https://github.com/lindorm-io/monorepo/commit/6fe2ac818d0deba7e68f799b7f856c7ebf419832))

# [0.2.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/zephyr@0.1.1...@lindorm/zephyr@0.2.0) (2026-05-02)

### Bug Fixes

- widen @lindorm/\* peer ranges to unbounded >= ([f192b59](https://github.com/lindorm-io/monorepo/commit/f192b59107bf1f276d296837f40fa97765d9d2ba))
- **zephyr:** typecheck cleanup ([e9b3067](https://github.com/lindorm-io/monorepo/commit/e9b3067693416d66455c29085fb3ffca70e18786))

### Features

- migrate 20 packages from jest to vitest ([d8bfda8](https://github.com/lindorm-io/monorepo/commit/d8bfda8854dc1cb9537ba0b3e47ec4e4c7bded08))

## [0.1.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/zephyr@0.1.0...@lindorm/zephyr@0.1.1) (2026-04-19)

### Bug Fixes

- **zephyr:** widen @lindorm/\* peer ranges to current workspace versions ([70b98ea](https://github.com/lindorm-io/monorepo/commit/70b98ea91895e0f3fc99e8a277cd585b95f8df5d))

# 0.1.0 (2026-04-15)

### Features

- **pylon:** pin cnf.jkt across bearer refresh ([ddf83ba](https://github.com/lindorm-io/monorepo/commit/ddf83bac62ea2d1c9fbd754d3df5ae506bc48280))
- **zephyr:** add changeKeys middleware for outgoing/incoming data ([e56ff95](https://github.com/lindorm-io/monorepo/commit/e56ff9598d1dade9aa72d03573e378f9de4f4deb))
- **zephyr:** add core types, ZephyrError, and package exports ([b27738f](https://github.com/lindorm-io/monorepo/commit/b27738feb5ce5003fdb46a0bf19d359648bf8d5e))
- **zephyr:** add createBearerAuthStrategy ([9f5ae43](https://github.com/lindorm-io/monorepo/commit/9f5ae433275bc3cb1fc25560b7c0b3d2c427b5bd))
- **zephyr:** add createCookieAuthStrategy ([9846abf](https://github.com/lindorm-io/monorepo/commit/9846abfdbeb9872e1d313f34b0d60c237067da76))
- **zephyr:** add createDpopBearerAuthStrategy ([e2a7842](https://github.com/lindorm-io/monorepo/commit/e2a78429659a08c664af79cec6bc0a3ac9b645a6))
- **zephyr:** add createMockZephyr and createMockZephyrRoom mock factories ([202978a](https://github.com/lindorm-io/monorepo/commit/202978aa47dae8892b87f7388bbc0527fcc3e820))
- **zephyr:** add dedupe-promise utility ([d133cbb](https://github.com/lindorm-io/monorepo/commit/d133cbba7c6a6fab65f8e3aaef117a21a5d44e0f))
- **zephyr:** add React hooks — ZephyrProvider, useZephyr, useRequest, useEvent, useRoom ([73811a3](https://github.com/lindorm-io/monorepo/commit/73811a3e9c61d25b394e3f0d96beef50e44a0c25))
- **zephyr:** add resolveHandshakeHtu utility ([f088a72](https://github.com/lindorm-io/monorepo/commit/f088a72a592d8661ec37512df662016aa2a9ee7a))
- **zephyr:** add signDpopProof utility ([11dec41](https://github.com/lindorm-io/monorepo/commit/11dec41aebec5de85c853df9f9ba48633f8e8615))
- **zephyr:** add type-safe event definitions via generic Zephyr<Events> ([ec1768b](https://github.com/lindorm-io/monorepo/commit/ec1768b7fd4c62b4b36a26fa39227f43c2fd5abe))
- **zephyr:** add ZephyrRoom with IZephyr and IZephyrRoom interfaces ([b173b16](https://github.com/lindorm-io/monorepo/commit/b173b167c0070d94b468999ea410e30d0da01d41))
- **zephyr:** implement core Zephyr client with emit, request, on/off, and lifecycle hooks ([11d5bb6](https://github.com/lindorm-io/monorepo/commit/11d5bb655b009c9cb97465dde31ff24f4912bf26))
- **zephyr:** initialise zephyr ([42d2f43](https://github.com/lindorm-io/monorepo/commit/42d2f4300a2153d062c14a6b289e1801c424f8a8))
