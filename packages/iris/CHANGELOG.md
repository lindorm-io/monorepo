# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.2.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/iris@0.1.1...@lindorm/iris@0.2.0) (2026-04-15)

### Bug Fixes

- **iris:** access private KafkaDriver.state via any-cast in TCK teardown ([ef287a1](https://github.com/lindorm-io/monorepo/commit/ef287a11db5b6a918a7632354669a81d5c598329))
- **iris:** add explicit return types and resolve floating promises ([ead09b4](https://github.com/lindorm-io/monorepo/commit/ead09b46e6f6320799f228b3d906f173ab4e044c))
- **iris:** add explicit return types to inline arrow functions ([e8c76f3](https://github.com/lindorm-io/monorepo/commit/e8c76f3dc4ee86218d72eb282dc843711c3b9b17))
- **iris:** decrypt message payload by exact kid, not predicate ([aa6b70e](https://github.com/lindorm-io/monorepo/commit/aa6b70ee5b4038f28db9b01712f8b22fb9c182c9))
- **iris:** force serial test execution to avoid kafka consumer rebalance race ([8ac245b](https://github.com/lindorm-io/monorepo/commit/8ac245b73e569a7407d23c1a97203d89c7885a63))
- **iris:** improve init source template ([a546c39](https://github.com/lindorm-io/monorepo/commit/a546c3946003fc2d4792d150eddbe177aa451fd4))
- **proteus,iris,hermes:** simplify logger in init templates ([76230f8](https://github.com/lindorm-io/monorepo/commit/76230f8c4e4c96ff8b0858e518ac44be455d25cf))

### Features

- **iris:** add CLI with init and generate message commands ([7e4ec39](https://github.com/lindorm-io/monorepo/commit/7e4ec39ea14af77c4192e12655de8dbc21f6f1df))

### Performance Improvements

- **iris:** detach kafka consumers on reset instead of awaiting stop ([4506d9e](https://github.com/lindorm-io/monorepo/commit/4506d9e8d08f71ef0a9637008ebdbf49b692d073))
- **iris:** set explicit rpc timeout for no-handler tck tests ([04564e0](https://github.com/lindorm-io/monorepo/commit/04564e0c8b9fd50117880828c52c1913c3527ac4))
- **iris:** speed up kafka tck tests ([8c633d9](https://github.com/lindorm-io/monorepo/commit/8c633d9dba36508f270ca5c77642b6f3358efd59))

## [0.1.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/iris@0.1.0...@lindorm/iris@0.1.1) (2026-04-01)

**Note:** Version bump only for package @lindorm/iris

# 0.1.0 (2026-03-29)

### Bug Fixes

- **iris:** ensure Kafka topic exists before publishing ([d392eef](https://github.com/lindorm-io/monorepo/commit/d392eef094763dabce12d6ce5312c511c255d1f7))
- **iris:** remove redundant type casts and fix type narrowing in MessageScanner ([c8f3eb8](https://github.com/lindorm-io/monorepo/commit/c8f3eb8fff0d969e359cb755d23d81a8f95c80d8))

### Features

- add @lindorm/iris unified messaging package ([1c33993](https://github.com/lindorm-io/monorepo/commit/1c33993d5ec4b600de188408477ae24e8dea8e03))
