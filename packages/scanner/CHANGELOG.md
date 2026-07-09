# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.6.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.3.7...@lindorm/scanner@0.6.0) (2026-07-09)

### Bug Fixes

- **eslint:** forbid redundant public via explicit-member-accessibility no-public ([e759b1f](https://github.com/lindorm-io/monorepo/commit/e759b1f1c552b50d150aecca51488eac64856d91))
- mock tsx/cjs/api in scanner tests to prevent Jest namespace conflicts ([bbb78e0](https://github.com/lindorm-io/monorepo/commit/bbb78e0e28c374fc876c361194c57f0e42fd2a23))
- **scanner:** skip sourcemaps and .d.ts declarations by default ([8aa12bb](https://github.com/lindorm-io/monorepo/commit/8aa12bb995cf21e95ea5c48403ba63a513b018be))
- **scanner:** treat a missing scan directory as empty, not ENOENT ([19a18d8](https://github.com/lindorm-io/monorepo/commit/19a18d8080b63da1d8f6b7688c77a8d0cfc777b6))

### Features

- migrate 20 packages from jest to vitest ([e9d3c7a](https://github.com/lindorm-io/monorepo/commit/e9d3c7ad717b15fee223451242eb8d7bb71edf4a))
- **scanner:** add CJS interop via tsx and improve Scanner ([d70b4ee](https://github.com/lindorm-io/monorepo/commit/d70b4eed34f7d19eb731f91de50cdb6282ec2aa5))
- **scanner:** fall back to tsx loader for .ts files native import rejects ([2a33dee](https://github.com/lindorm-io/monorepo/commit/2a33dee781752ef143ae5d098186c71f76788de7))
- **scanner:** switch import() to native dynamic import and flatten ScanData ([587130c](https://github.com/lindorm-io/monorepo/commit/587130caad7bb3d1752c407a14b221f42f07f5d9))

## [0.5.7](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.5.6...@lindorm/scanner@0.5.7) (2026-07-04)

### Bug Fixes

- **scanner:** skip sourcemaps and .d.ts declarations by default ([0286036](https://github.com/lindorm-io/monorepo/commit/0286036f69c8c4d9ab1e2c940a17ab4969e6e5c6))
- **scanner:** treat a missing scan directory as empty, not ENOENT ([0e960b9](https://github.com/lindorm-io/monorepo/commit/0e960b9cacd1418ac57eebd3f8149daa76a572ea))

## [0.5.6](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.5.5...@lindorm/scanner@0.5.6) (2026-07-02)

### Bug Fixes

- **eslint:** forbid redundant public via explicit-member-accessibility no-public ([0ca0e95](https://github.com/lindorm-io/monorepo/commit/0ca0e953509d6d28baabcbc5233c1a17e6e6efa0))

## [0.5.5](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.5.4...@lindorm/scanner@0.5.5) (2026-06-19)

**Note:** Version bump only for package @lindorm/scanner

## [0.5.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.5.3...@lindorm/scanner@0.5.4) (2026-06-15)

**Note:** Version bump only for package @lindorm/scanner

## [0.5.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.5.2...@lindorm/scanner@0.5.3) (2026-06-05)

**Note:** Version bump only for package @lindorm/scanner

## [0.5.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.5.1...@lindorm/scanner@0.5.2) (2026-05-05)

**Note:** Version bump only for package @lindorm/scanner

## [0.5.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.5.0...@lindorm/scanner@0.5.1) (2026-05-05)

**Note:** Version bump only for package @lindorm/scanner

# [0.5.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.4.4...@lindorm/scanner@0.5.0) (2026-05-02)

### Features

- migrate 20 packages from jest to vitest ([d8bfda8](https://github.com/lindorm-io/monorepo/commit/d8bfda8854dc1cb9537ba0b3e47ec4e4c7bded08))
- **scanner:** fall back to tsx loader for .ts files native import rejects ([6817867](https://github.com/lindorm-io/monorepo/commit/6817867b84fdcb31bc76cec391d263125a3e3157))
- **scanner:** switch import() to native dynamic import and flatten ScanData ([bcfa584](https://github.com/lindorm-io/monorepo/commit/bcfa584f375470fcc982a277e3f35812ef6ce5bc))

## [0.4.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.4.3...@lindorm/scanner@0.4.4) (2026-04-19)

**Note:** Version bump only for package @lindorm/scanner

## [0.4.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.4.2...@lindorm/scanner@0.4.3) (2026-04-15)

**Note:** Version bump only for package @lindorm/scanner

## [0.4.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.4.1...@lindorm/scanner@0.4.2) (2026-04-01)

**Note:** Version bump only for package @lindorm/scanner

## [0.4.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.4.0...@lindorm/scanner@0.4.1) (2026-03-13)

**Note:** Version bump only for package @lindorm/scanner

# [0.4.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.3.8...@lindorm/scanner@0.4.0) (2026-03-13)

### Bug Fixes

- mock tsx/cjs/api in scanner tests to prevent Jest namespace conflicts ([cae3ffb](https://github.com/lindorm-io/monorepo/commit/cae3ffbd1df651d574c34647ca695e312efd4280))

### Features

- **scanner:** add CJS interop via tsx and improve Scanner ([bed20cc](https://github.com/lindorm-io/monorepo/commit/bed20cc838a731ac98da3e11be66953302bb87ea))

## [0.3.8](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.3.7...@lindorm/scanner@0.3.8) (2026-02-17)

**Note:** Version bump only for package @lindorm/scanner

## [0.3.7](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.3.6...@lindorm/scanner@0.3.7) (2025-09-18)

**Note:** Version bump only for package @lindorm/scanner

## [0.3.6](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.3.5...@lindorm/scanner@0.3.6) (2025-07-19)

**Note:** Version bump only for package @lindorm/scanner

## [0.3.5](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.3.4...@lindorm/scanner@0.3.5) (2025-07-10)

**Note:** Version bump only for package @lindorm/scanner

## [0.3.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.3.3...@lindorm/scanner@0.3.4) (2025-07-02)

**Note:** Version bump only for package @lindorm/scanner

## [0.3.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.3.2...@lindorm/scanner@0.3.3) (2025-06-17)

### Bug Fixes

- update try catch ([7ebebe8](https://github.com/lindorm-io/monorepo/commit/7ebebe81f40851b0d1fcb05e6e6cc60b1c754a91))

## [0.3.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.3.1...@lindorm/scanner@0.3.2) (2025-01-28)

**Note:** Version bump only for package @lindorm/scanner

## [0.3.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.3.0...@lindorm/scanner@0.3.1) (2024-10-12)

**Note:** Version bump only for package @lindorm/scanner

# [0.3.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.2.1...@lindorm/scanner@0.3.0) (2024-10-09)

### Features

- return class object for consistency ([de752e0](https://github.com/lindorm-io/monorepo/commit/de752e062f6bef8c059c79fabd7b6412990c2f5c))

## [0.2.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.2.0...@lindorm/scanner@0.2.1) (2024-09-25)

**Note:** Version bump only for package @lindorm/scanner

# [0.2.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.1.1...@lindorm/scanner@0.2.0) (2024-09-20)

### Bug Fixes

- export interfaces ([104173f](https://github.com/lindorm-io/monorepo/commit/104173f62db6ae09fb1d68fc0f0b61912fe68930))
- include stats about the scanned directory ([4df4efc](https://github.com/lindorm-io/monorepo/commit/4df4efc9e95b6e5a02ed9a10d7e3794f06bf26a6))

### Features

- rename scanner and add interface ([4207d8a](https://github.com/lindorm-io/monorepo/commit/4207d8aad9f899d0b5755002b2976a5868c6c60b))

## [0.1.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/scanner@0.1.0...@lindorm/scanner@0.1.1) (2024-05-19)

**Note:** Version bump only for package @lindorm/scanner

# 0.1.0 (2024-05-11)

### Features

- initialise scanner package ([a550457](https://github.com/lindorm-io/monorepo/commit/a5504573d021ee0eddcc4d23550ac4499b21a3f3))
