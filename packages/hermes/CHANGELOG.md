# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.7.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.7.1...@lindorm/hermes@0.7.2) (2026-05-05)

### Bug Fixes

- **packages:** declare files: ["dist"] for every publishable package ([6fe2ac8](https://github.com/lindorm-io/monorepo/commit/6fe2ac818d0deba7e68f799b7f856c7ebf419832))

## [0.7.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.7.0...@lindorm/hermes@0.7.1) (2026-05-05)

**Note:** Version bump only for package @lindorm/hermes

# [0.7.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.6.1...@lindorm/hermes@0.7.0) (2026-05-02)

### Bug Fixes

- **hermes:** typecheck cleanup ([e124a0a](https://github.com/lindorm-io/monorepo/commit/e124a0a30f97f8f225c767164e43dd5af4fd1b84))
- widen @lindorm/\* peer ranges to unbounded >= ([f192b59](https://github.com/lindorm-io/monorepo/commit/f192b59107bf1f276d296837f40fa97765d9d2ba))

### Features

- **hermes:** migrate tests from jest to vitest ([5e0573d](https://github.com/lindorm-io/monorepo/commit/5e0573d59c31b394198183d36cfd0398d2dffc9b))

## [0.6.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.6.0...@lindorm/hermes@0.6.1) (2026-04-19)

### Bug Fixes

- **hermes:** correct invalid "jsonb" entity field types ([a855d1a](https://github.com/lindorm-io/monorepo/commit/a855d1a10d2bc31a9eede1d7bbd95b12d5a9856d))
- **hermes:** correct invalid "jsonb" message field types ([6db5882](https://github.com/lindorm-io/monorepo/commit/6db5882ae305439e154bfcde9c003fe6ddba4a33))
- **hermes:** widen @lindorm/\* peer ranges to current workspace versions ([2a0c8cf](https://github.com/lindorm-io/monorepo/commit/2a0c8cfb75c454a66b771cc9db0eafa41c111cd6))

# [0.6.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.5.0...@lindorm/hermes@0.6.0) (2026-04-15)

### Bug Fixes

- **hermes:** add explicit return types to inline arrow functions ([f93f530](https://github.com/lindorm-io/monorepo/commit/f93f530c5d7b18e876d0e5794bdabc9471cff965))
- **proteus,iris,hermes:** simplify logger in init templates ([76230f8](https://github.com/lindorm-io/monorepo/commit/76230f8c4e4c96ff8b0858e518ac44be455d25cf))

### Features

- **hermes:** add CLI with init and generate commands ([8b49b2e](https://github.com/lindorm-io/monorepo/commit/8b49b2ee3d2ab1233623ab522413dc01371a63c4))
- **hermes:** mark EventRecord and ChecksumRecord as @AppendOnly ([92de440](https://github.com/lindorm-io/monorepo/commit/92de4407d05f8740c5aff6a230e8a27f539eaa5c))

# [0.5.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.3.7...@lindorm/hermes@0.5.0) (2026-04-01)

### Features

- **hermes:** implement v2 decorator-based CQRS/ES architecture ([db34177](https://github.com/lindorm-io/monorepo/commit/db341774f4c0c73dcfe7a478aad226d23d74a895))

## [0.3.7](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.3.6...@lindorm/hermes@0.3.7) (2026-03-13)

**Note:** Version bump only for package @lindorm/hermes

## [0.3.6](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.3.5...@lindorm/hermes@0.3.6) (2026-03-13)

### Bug Fixes

- add missing MySQL service, fix MongoDB replica set and auth config ([4af2231](https://github.com/lindorm-io/monorepo/commit/4af223104c7e5e88b0b28e9ff9fa40600282c676))
- mock tsx/cjs/api in remaining tests and stabilise error snapshots ([5e12e6a](https://github.com/lindorm-io/monorepo/commit/5e12e6a3ad52c4cee5359e37fa9fff39533f64d2))
- resolve all eslint warnings across entity, message, hermes, and proteus ([a7aaefc](https://github.com/lindorm-io/monorepo/commit/a7aaefcd2ae48901b546fa191e23edf90ecc22c4))

## [0.3.5](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.3.4...@lindorm/hermes@0.3.5) (2026-02-17)

### Bug Fixes

- **hermes:** update decryptAttributes for AES v1.0 format and fix integration test race condition ([7239c46](https://github.com/lindorm-io/monorepo/commit/7239c4661a22f82b71de316b90edaa44b16ffa6f))

## [0.3.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.3.3...@lindorm/hermes@0.3.4) (2025-09-18)

### Bug Fixes

- add more predicate operators and move to types ([c86a27a](https://github.com/lindorm-io/monorepo/commit/c86a27a9640ee5a014fc8d65ff556dc5feaff4bb))
- use instanceof instead of name ([32d7e31](https://github.com/lindorm-io/monorepo/commit/32d7e31a81a0766f2165afc5c1a9106c957b5d6e))

## [0.3.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.3.2...@lindorm/hermes@0.3.3) (2025-07-19)

### Bug Fixes

- move middleware to pylon ([a31f6c2](https://github.com/lindorm-io/monorepo/commit/a31f6c20c35629f6c905d657fd53d5b423636c60))
- remove unnecessary enums ([d0364d9](https://github.com/lindorm-io/monorepo/commit/d0364d97ad0dc621a1020d4ddba8d3a87959838d))

## [0.3.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.3.1...@lindorm/hermes@0.3.2) (2025-07-13)

### Bug Fixes

- add kafka source to message bus options ([180e719](https://github.com/lindorm-io/monorepo/commit/180e7190efded2464046ec94ef99e9e917a2b5f5))

## [0.3.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.3.0...@lindorm/hermes@0.3.1) (2025-07-12)

### Bug Fixes

- add redis message bus to infrastructure ([569c526](https://github.com/lindorm-io/monorepo/commit/569c526fb434afaa3b010172d12ce601e441631a))
- amend issues with metadata ([abd603c](https://github.com/lindorm-io/monorepo/commit/abd603cc45c2dea428697a071a3345cb5739d7c6))
- update kit target nomenclature ([7358ebc](https://github.com/lindorm-io/monorepo/commit/7358ebcbe11ed4a4ed5c581ebeebefd64637c1e5))

# [0.3.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.2.4...@lindorm/hermes@0.3.0) (2025-07-10)

### Features

- add decorator architecture ([43004a2](https://github.com/lindorm-io/monorepo/commit/43004a24de8556f972e95e9ccb47bbdb56d2b948))
- rename context to namespace ([70f0c4c](https://github.com/lindorm-io/monorepo/commit/70f0c4c6a62008302e7172621dc247fdb34b9055))
- use improved messages ([bc83850](https://github.com/lindorm-io/monorepo/commit/bc8385051231b60e1b82dc133fa6de0e14194a43))

## [0.2.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.2.3...@lindorm/hermes@0.2.4) (2025-07-02)

**Note:** Version bump only for package @lindorm/hermes

## [0.2.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.2.2...@lindorm/hermes@0.2.3) (2025-06-25)

**Note:** Version bump only for package @lindorm/hermes

## [0.2.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.2.1...@lindorm/hermes@0.2.2) (2025-06-24)

**Note:** Version bump only for package @lindorm/hermes

## [0.2.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.2.0...@lindorm/hermes@0.2.1) (2025-06-17)

### Bug Fixes

- align hermes with kryptos and utils ([eb11c21](https://github.com/lindorm-io/monorepo/commit/eb11c216a7d5e0c7e3de7aafa232082edf469423))
- align with changes to kryptos ([74bbfff](https://github.com/lindorm-io/monorepo/commit/74bbfff6fb50504dc70327f7de3fd6d4b45cb65a))
- amend bugs ([a68a77a](https://github.com/lindorm-io/monorepo/commit/a68a77a811ddfe33a0b487cd84cda6a18d3054b6))

# [0.2.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.1.1...@lindorm/hermes@0.2.0) (2025-01-28)

### Features

- improve entity middleware to accept object as path arg ([1506f7e](https://github.com/lindorm-io/monorepo/commit/1506f7e5ab4cd90866916c4b151e61becb27dc06))

## [0.1.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/hermes@0.1.0...@lindorm/hermes@0.1.1) (2024-10-12)

**Note:** Version bump only for package @lindorm/hermes

# 0.1.0 (2024-10-09)

### Bug Fixes

- align column nomenclature ([0e079df](https://github.com/lindorm-io/monorepo/commit/0e079df506adbf4c606a08ed5e97c0d9ab4fdae1))
- align with aes changes ([f49b8c0](https://github.com/lindorm-io/monorepo/commit/f49b8c01cb8893e624da046832965bf64889117b))
- move event store logic into domain ([5090e0f](https://github.com/lindorm-io/monorepo/commit/5090e0f9657bccccec399b508e5a399fd0f83ddd))
- remove redundant saga and view hash ([5e27521](https://github.com/lindorm-io/monorepo/commit/5e27521682f5ebd1b136282c9e94739d5b6c948a))
- use quicker getter for id ([3d29ab1](https://github.com/lindorm-io/monorepo/commit/3d29ab1a0d1e0b3dbbac9557fab66654f1f872a9))
- use update from query builder ([298ae7f](https://github.com/lindorm-io/monorepo/commit/298ae7f1fea28a84407915a3ab0f5c1e43210079))

### Features

- add encrypted storage ([ce112a5](https://github.com/lindorm-io/monorepo/commit/ce112a592e6a83b78ebe15c802fa4004ef75b04c))
- add middleware and cloning ([537bdb3](https://github.com/lindorm-io/monorepo/commit/537bdb30bffb04a0edc58a6447834cfe633244a6))
- improve repository functionality ([1a30fa7](https://github.com/lindorm-io/monorepo/commit/1a30fa777f3432cc7d72376f8eb9ac9202c5b207))
- initialise hermes package ([23ed7ae](https://github.com/lindorm-io/monorepo/commit/23ed7ae22776098a74cb6b12c92ed2cb7a9193e0))
- move json-kit into query builder ([4df5f14](https://github.com/lindorm-io/monorepo/commit/4df5f14b4a12d37a640ffe31a6d0a9e885d3084a))
- update saga store interface ([c8e3dbe](https://github.com/lindorm-io/monorepo/commit/c8e3dbed3bf472f18c9baeb7a219fe55a2a91b72))
- update view store and amend bugs ([6427af1](https://github.com/lindorm-io/monorepo/commit/6427af1bcef47ecd0814d54fa814167b434d8054))
- use postgres query builder and split events ([96ded9a](https://github.com/lindorm-io/monorepo/commit/96ded9aae5d07098f121818c269997e2d1538b63))
- verify context and name length ([8627653](https://github.com/lindorm-io/monorepo/commit/862765338327b70a2ef05fcca2b67ccc7ad71747))
