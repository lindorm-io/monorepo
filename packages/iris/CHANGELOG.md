# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.7.0 (2026-07-09)

### Bug Fixes

- declare zod as a peerDependency on packages with zod-typed public APIs ([790bc68](https://github.com/lindorm-io/monorepo/commit/790bc689aa8e9450f74c3e880cbe3825a0d680ae))
- **eslint:** forbid redundant public via explicit-member-accessibility no-public ([e759b1f](https://github.com/lindorm-io/monorepo/commit/e759b1f1c552b50d150aecca51488eac64856d91))
- **esm:** switch ioredis imports to named Redis export ([dc2cb8a](https://github.com/lindorm-io/monorepo/commit/dc2cb8a47f999996482bbaf2a4a2fa12effe5287))
- **iris:** access private KafkaDriver.state via any-cast in TCK teardown ([30c8c47](https://github.com/lindorm-io/monorepo/commit/30c8c47b732349c0725ca079f119c6e6b1461c7b))
- **iris:** add explicit return types and resolve floating promises ([3a13bf5](https://github.com/lindorm-io/monorepo/commit/3a13bf5f90a871f10448f7cf4753457510f06b23))
- **iris:** add explicit return types to inline arrow functions ([3d6cae1](https://github.com/lindorm-io/monorepo/commit/3d6cae10b66be7455c89ade476efa8987b23f89d))
- **iris:** decrypt message payload by exact kid, not predicate ([d7cedeb](https://github.com/lindorm-io/monorepo/commit/d7cedeb96ca471569183c633a35c66ebbfbc3614))
- **iris:** ensure Kafka topic exists before publishing ([4ddc87f](https://github.com/lindorm-io/monorepo/commit/4ddc87f8a0e7e3dd90802bb36e6c0c50d728a09e))
- **iris:** force serial test execution to avoid kafka consumer rebalance race ([7a1f4dc](https://github.com/lindorm-io/monorepo/commit/7a1f4dc677f869c404e60e44305e22103ccf2683))
- **iris:** harden NATS reset and surface flaky test diagnostics ([60eba23](https://github.com/lindorm-io/monorepo/commit/60eba2300a12a79e3694903b54bf7a2e5982e415))
- **iris:** honor the caller's explicit consume topic for dynamic @Topic messages ([f9509e7](https://github.com/lindorm-io/monorepo/commit/f9509e7c805a24da0ffc0fb4fc451aaede3c3c02))
- **iris:** improve init source template ([3159410](https://github.com/lindorm-io/monorepo/commit/3159410c9c9d798bd2a88c39b34bd3bcfb693581))
- **iris:** let @Generated determine the type of a role-marker field ([1993853](https://github.com/lindorm-io/monorepo/commit/1993853b05a7317dba78da4de6266f51184b3d61))
- **iris:** polyfill Symbol.metadata at package entry ([4588a8b](https://github.com/lindorm-io/monorepo/commit/4588a8b34256b0f40b152e9b56580ab24c112c75))
- **iris:** reject unknown fields during message validation ([a1a819b](https://github.com/lindorm-io/monorepo/commit/a1a819b069324c8e6ee855571f2eae90b9ef1fec))
- **iris:** remove redundant type casts and fix type narrowing in MessageScanner ([73e5851](https://github.com/lindorm-io/monorepo/commit/73e585189753fcd61fc7d42351342b472e52939b))
- **iris:** typecheck cleanup ([7242b0c](https://github.com/lindorm-io/monorepo/commit/7242b0ce8be4783904bfb85f5247995c297e4fcb))
- **iris:** update ioredis mock for ESM named Redis export ([332d1ce](https://github.com/lindorm-io/monorepo/commit/332d1ce6ca73c7a566aad2d969f60568e3d650bb))
- **iris:** use import.meta.dirname and accept configImport in generateSource ([be14499](https://github.com/lindorm-io/monorepo/commit/be14499dc8f86e20ebb200f0e8a98931903fe8a8))
- **iris:** use positional filter in test:integration script ([23f4acb](https://github.com/lindorm-io/monorepo/commit/23f4acb1d220c3005fda6df9cc27fc7128f2600e))
- **proteus,iris,hermes:** simplify logger in init templates ([79df6d8](https://github.com/lindorm-io/monorepo/commit/79df6d889f945c3731a83974d2ba96e6565cd26b))
- widen @lindorm/\* peer ranges to unbounded >= ([9655dec](https://github.com/lindorm-io/monorepo/commit/9655dec5ce8d66b4691faa98352980bef11a466e))

### Features

- add @lindorm/iris unified messaging package ([642ed39](https://github.com/lindorm-io/monorepo/commit/642ed39ba1ca173c163cbcf9b251ee4ed3388f96))
- **iris:** add CLI with init and generate message commands ([02ae3b7](https://github.com/lindorm-io/monorepo/commit/02ae3b73ffcc0d839f6b9aeca40256d167c07655))
- **iris:** add lindorm_id strategy and function form to @Generated ([7a503e9](https://github.com/lindorm-io/monorepo/commit/7a503e9dae617c5716b8e50366a29d0be93cc5e0))
- **iris:** add Nullable, Default, and Optional field decorators ([5a13aea](https://github.com/lindorm-io/monorepo/commit/5a13aeaadff5f8275cf9c04462e68c6d38fe5afd))
- **iris:** add titles and details to thrown errors ([664cbd2](https://github.com/lindorm-io/monorepo/commit/664cbd26a100aec364b6324d7c901e9fba4e38df))
- **iris:** align driver behavior with real-broker semantics ([7b301d6](https://github.com/lindorm-io/monorepo/commit/7b301d6a8eb057c755ab458f1f3e9a7404269f5b))
- **iris:** default identifier and correlation ids to lindorm random id ([fe49750](https://github.com/lindorm-io/monorepo/commit/fe4975037976f29eb9309880d7a2244d49d27d3d))
- **iris:** migrate tests from jest to vitest ([3f3d893](https://github.com/lindorm-io/monorepo/commit/3f3d89392f24adaecf778882f1b332d683596886))
- **iris:** namespace and enrich thrown errors ([57520c2](https://github.com/lindorm-io/monorepo/commit/57520c265c3c06863c0898c52a7822481819590c))
- **iris:** reject duplicate @Generated on a field ([801c2ea](https://github.com/lindorm-io/monorepo/commit/801c2eaaab315b3af1c77b42717661cd6d85d160))
- **iris:** resolve init/message dirs via lindorm.config ([1e8cef6](https://github.com/lindorm-io/monorepo/commit/1e8cef64c9fe148dca3dfa5416628c130eda4f13))
- **iris:** scaffold sources export the driver name, not `source` ([30566d1](https://github.com/lindorm-io/monorepo/commit/30566d1f78310a22f2de5b827ce5666772dbc187))
- **iris:** support namespace on @Generated("lindorm_id") ([a03f7e2](https://github.com/lindorm-io/monorepo/commit/a03f7e2d62fc3269617645e280773e97ee5dd7db))

### Performance Improvements

- **iris:** detach kafka consumers on reset instead of awaiting stop ([721a0b3](https://github.com/lindorm-io/monorepo/commit/721a0b3da6649bfdde87bb810194a3d336136a05))
- **iris:** set explicit rpc timeout for no-handler tck tests ([e03d937](https://github.com/lindorm-io/monorepo/commit/e03d9370551a825a90d80c3ba779acd0c6cc1983))
- **iris:** speed up kafka tck tests ([f972483](https://github.com/lindorm-io/monorepo/commit/f9724837c37779e538449f4863353ac25c5794ff))

## [0.6.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/iris@0.6.1...@lindorm/iris@0.6.2) (2026-07-04)

**Note:** Version bump only for package @lindorm/iris

## [0.6.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/iris@0.6.0...@lindorm/iris@0.6.1) (2026-07-02)

### Bug Fixes

- declare zod as a peerDependency on packages with zod-typed public APIs ([eb46f80](https://github.com/lindorm-io/monorepo/commit/eb46f802ccaacf92a06250440edd7df97b57e5e6))
- **eslint:** forbid redundant public via explicit-member-accessibility no-public ([0ca0e95](https://github.com/lindorm-io/monorepo/commit/0ca0e953509d6d28baabcbc5233c1a17e6e6efa0))

# [0.6.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/iris@0.5.0...@lindorm/iris@0.6.0) (2026-06-19)

### Bug Fixes

- **iris:** let @Generated determine the type of a role-marker field ([aa57761](https://github.com/lindorm-io/monorepo/commit/aa57761eec52dd5e5b8fd0e1664bd945ad1de747))

### Features

- **iris:** add lindorm_id strategy and function form to @Generated ([d54e53e](https://github.com/lindorm-io/monorepo/commit/d54e53ebc034a5cc25481ce046a79b3598185f65))
- **iris:** default identifier and correlation ids to lindorm random id ([ba41d52](https://github.com/lindorm-io/monorepo/commit/ba41d529fc04801a26ecc4ced7754716b1a82a84))
- **iris:** reject duplicate @Generated on a field ([56d5673](https://github.com/lindorm-io/monorepo/commit/56d5673cd95c50c881b09a9f8286b78c4de1186c))
- **iris:** support namespace on @Generated("lindorm_id") ([cd92e0c](https://github.com/lindorm-io/monorepo/commit/cd92e0c59f3dafdd05cfa66eaaf71fbd7f240ef6))

# [0.5.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/iris@0.4.3...@lindorm/iris@0.5.0) (2026-06-15)

### Bug Fixes

- **iris:** honor the caller's explicit consume topic for dynamic @Topic messages ([805f87f](https://github.com/lindorm-io/monorepo/commit/805f87ff9f308bff4104cfd90fa7491b5981759f))

### Features

- **iris:** add titles and details to thrown errors ([e6d76a2](https://github.com/lindorm-io/monorepo/commit/e6d76a2be4a3c43016432cb2a11eb145e3bd5600))
- **iris:** align driver behavior with real-broker semantics ([6a27fb6](https://github.com/lindorm-io/monorepo/commit/6a27fb6601ba25b9eb5ec4d5f7897524c81b5497))
- **iris:** namespace and enrich thrown errors ([4a8db00](https://github.com/lindorm-io/monorepo/commit/4a8db00b1738547b1a5b1313ff6ca2f80c9a5faa))

## [0.4.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/iris@0.4.2...@lindorm/iris@0.4.3) (2026-06-05)

**Note:** Version bump only for package @lindorm/iris

## [0.4.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/iris@0.4.1...@lindorm/iris@0.4.2) (2026-05-05)

### Bug Fixes

- **iris:** use import.meta.dirname and accept configImport in generateSource ([a195453](https://github.com/lindorm-io/monorepo/commit/a1954536f55155801700906f82236297acfc7732))

## [0.4.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/iris@0.4.0...@lindorm/iris@0.4.1) (2026-05-05)

### Bug Fixes

- **iris:** harden NATS reset and surface flaky test diagnostics ([dd363f7](https://github.com/lindorm-io/monorepo/commit/dd363f7544764e89d18a8a0773b65a6cd3a9e939))

# [0.4.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/iris@0.3.0...@lindorm/iris@0.4.0) (2026-05-02)

### Bug Fixes

- **esm:** switch ioredis imports to named Redis export ([88e7365](https://github.com/lindorm-io/monorepo/commit/88e7365e0a3e2780087449c34bdb47b886d37ef0))
- **iris:** polyfill Symbol.metadata at package entry ([a6be1d3](https://github.com/lindorm-io/monorepo/commit/a6be1d3b95114dab515acef6e4b56cfb7c6c6ac7))
- **iris:** typecheck cleanup ([c4e6c04](https://github.com/lindorm-io/monorepo/commit/c4e6c04ee6a8139203e289a9b3e262a151ae5f78))
- **iris:** update ioredis mock for ESM named Redis export ([972fafc](https://github.com/lindorm-io/monorepo/commit/972fafcdca71fcef60ae9c41637653dc316cfb6e))
- **iris:** use positional filter in test:integration script ([444b87e](https://github.com/lindorm-io/monorepo/commit/444b87e2067be32dfe7ef8d97169cd9aa1073d37))
- widen @lindorm/\* peer ranges to unbounded >= ([f192b59](https://github.com/lindorm-io/monorepo/commit/f192b59107bf1f276d296837f40fa97765d9d2ba))

### Features

- **iris:** migrate tests from jest to vitest ([12518ab](https://github.com/lindorm-io/monorepo/commit/12518ab51f234a485d83039470a261d4f6179b29))

# [0.3.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/iris@0.2.0...@lindorm/iris@0.3.0) (2026-04-19)

### Bug Fixes

- **iris:** reject unknown fields during message validation ([d7e0ccb](https://github.com/lindorm-io/monorepo/commit/d7e0ccb929ba0a35487807e5b02e7dca5ed61b9f))

### Features

- **iris:** add Nullable, Default, and Optional field decorators ([a128f34](https://github.com/lindorm-io/monorepo/commit/a128f3437927970ee65b36210aba0c8136350ca5))

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
