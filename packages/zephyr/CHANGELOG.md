# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.5.0 (2026-07-09)

### Bug Fixes

- **eslint:** forbid redundant public via explicit-member-accessibility no-public ([e759b1f](https://github.com/lindorm-io/monorepo/commit/e759b1f1c552b50d150aecca51488eac64856d91))
- **packages:** declare files: ["dist"] for every publishable package ([b8d29fc](https://github.com/lindorm-io/monorepo/commit/b8d29fc24996a02636ddecc11c5d25da4930ef11))
- widen @lindorm/\* peer ranges to unbounded >= ([9655dec](https://github.com/lindorm-io/monorepo/commit/9655dec5ce8d66b4691faa98352980bef11a466e))
- **zephyr:** typecheck cleanup ([a795b88](https://github.com/lindorm-io/monorepo/commit/a795b883f03c5cde7d7f462654d63677e4ac4a35))
- **zephyr:** widen @lindorm/\* peer ranges to current workspace versions ([9353607](https://github.com/lindorm-io/monorepo/commit/93536078bf8fefc88a12f05e82be35333f9ab135))

### Features

- migrate 20 packages from jest to vitest ([e9d3c7a](https://github.com/lindorm-io/monorepo/commit/e9d3c7ad717b15fee223451242eb8d7bb71edf4a))
- **pylon:** pin cnf.jkt across bearer refresh ([8de63a6](https://github.com/lindorm-io/monorepo/commit/8de63a6deb2529d1f1d8746d98f8d2783e9c6e4d))
- **zephyr:** add changeKeys middleware for outgoing/incoming data ([90cc708](https://github.com/lindorm-io/monorepo/commit/90cc7089750f307020299abbd9d94cf078a6bc02))
- **zephyr:** add core types, ZephyrError, and package exports ([32b50cc](https://github.com/lindorm-io/monorepo/commit/32b50cc64fdeca0858a1a9c9322caf8df468c015))
- **zephyr:** add createBearerAuthStrategy ([7bb0558](https://github.com/lindorm-io/monorepo/commit/7bb055801988993af4c43fe10bd2ea1add9868ae))
- **zephyr:** add createCookieAuthStrategy ([68311a3](https://github.com/lindorm-io/monorepo/commit/68311a30ded662bc34e5f64c58222c1207c59b6a))
- **zephyr:** add createDpopBearerAuthStrategy ([033a29a](https://github.com/lindorm-io/monorepo/commit/033a29ac69306f4a7e459ce3c5a3fcff08ca522a))
- **zephyr:** add createMockZephyr and createMockZephyrRoom mock factories ([8fee41d](https://github.com/lindorm-io/monorepo/commit/8fee41d3ecb1c91f12206ea6b070002b8da898ea))
- **zephyr:** add dedupe-promise utility ([cda8b34](https://github.com/lindorm-io/monorepo/commit/cda8b34ec86ef195d906b77aa45483776a6fe433))
- **zephyr:** add React hooks — ZephyrProvider, useZephyr, useRequest, useEvent, useRoom ([5960a15](https://github.com/lindorm-io/monorepo/commit/5960a155b0304435bffcab5a8c5eaebb3dc8ccd2))
- **zephyr:** add resolveHandshakeHtu utility ([4077888](https://github.com/lindorm-io/monorepo/commit/40778882ac03213bda6fae0a21a22abebe719273))
- **zephyr:** add signDpopProof utility ([d9ac47e](https://github.com/lindorm-io/monorepo/commit/d9ac47e3bc0114a2a52e90b971e74e594ae42668))
- **zephyr:** add titles and details to thrown errors ([4e0d286](https://github.com/lindorm-io/monorepo/commit/4e0d2869cb2538317db0cda6f07670c6226efb23))
- **zephyr:** add type-safe event definitions via generic Zephyr<Events> ([84f292c](https://github.com/lindorm-io/monorepo/commit/84f292cf75e8078418152dd27c6eacd5b36909bf))
- **zephyr:** add ZephyrRoom with IZephyr and IZephyrRoom interfaces ([e637a8c](https://github.com/lindorm-io/monorepo/commit/e637a8cd461aaa853b3f86d3cc27c012aab2d33a))
- **zephyr:** implement core Zephyr client with emit, request, on/off, and lifecycle hooks ([5bd4c5a](https://github.com/lindorm-io/monorepo/commit/5bd4c5afadda72a17da81800c57b11de1178206f))
- **zephyr:** initialise zephyr ([a19fbf0](https://github.com/lindorm-io/monorepo/commit/a19fbf029ed7209cf9427ac81e6ec964cc10961b))
- **zephyr:** namespace and enrich thrown errors ([182c583](https://github.com/lindorm-io/monorepo/commit/182c5837a6446946e48017fce3c88982b91b5796))
- **zephyr:** namespaced lindorm ids for context and DPoP jti ([ef77f45](https://github.com/lindorm-io/monorepo/commit/ef77f45a3037e7136861cb978d47a67d71b35aeb))

## [0.4.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/zephyr@0.4.0...@lindorm/zephyr@0.4.1) (2026-07-02)

### Bug Fixes

- **eslint:** forbid redundant public via explicit-member-accessibility no-public ([0ca0e95](https://github.com/lindorm-io/monorepo/commit/0ca0e953509d6d28baabcbc5233c1a17e6e6efa0))

# [0.4.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/zephyr@0.3.0...@lindorm/zephyr@0.4.0) (2026-06-19)

### Features

- **zephyr:** namespaced lindorm ids for context and DPoP jti ([32a84c7](https://github.com/lindorm-io/monorepo/commit/32a84c7e1137c1b035569afb6bd51ce589f0db95))

# [0.3.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/zephyr@0.2.2...@lindorm/zephyr@0.3.0) (2026-06-15)

### Features

- **zephyr:** add titles and details to thrown errors ([dc14e12](https://github.com/lindorm-io/monorepo/commit/dc14e122675aba6fcc372c480937970fd51c0921))
- **zephyr:** namespace and enrich thrown errors ([2d30517](https://github.com/lindorm-io/monorepo/commit/2d305175ceacd1f4a638d85f571da5491e0011f1))

## [0.2.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/zephyr@0.2.1...@lindorm/zephyr@0.2.2) (2026-06-05)

**Note:** Version bump only for package @lindorm/zephyr

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
