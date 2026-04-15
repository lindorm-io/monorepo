# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.5.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/proteus@0.4.0...@lindorm/proteus@0.5.0) (2026-04-15)

### Bug Fixes

- **proteus,iris,hermes:** simplify logger in init templates ([76230f8](https://github.com/lindorm-io/monorepo/commit/76230f8c4e4c96ff8b0858e518ac44be455d25cf))
- **proteus:** add explicit return type to emitEntity default ([d8988cb](https://github.com/lindorm-io/monorepo/commit/d8988cb496cf1a49d8b280f1fa0f05f74a3c54e5))
- **proteus:** decrypt @Encrypted fields by exact kid, not predicate ([ba6f2ed](https://github.com/lindorm-io/monorepo/commit/ba6f2edd8bb344e8a7aafe37f26f0eb3ba84766a))
- **proteus:** improve init source template ([65553d8](https://github.com/lindorm-io/monorepo/commit/65553d8f6b217a156c77dd3076f721f31e7d1615))
- **proteus:** reject field initializers on lazy @EmbeddedList fields at metadata build ([ae3ad97](https://github.com/lindorm-io/monorepo/commit/ae3ad971e0b4ce737b3bd71fa21264ebeed22cc8))

### Features

- **proteus:** add @AppendOnly decorator with SQL trigger enforcement ([9f1a21a](https://github.com/lindorm-io/monorepo/commit/9f1a21aaed785ca5ecfc27b0e8a63a24013436e3))
- **proteus:** add init and generate entity CLI commands ([f5979fe](https://github.com/lindorm-io/monorepo/commit/f5979fe2b504287cc2d744e9d436d0eb1cf1aba7))
- **proteus:** add IProteusSource interface ([5ec548b](https://github.com/lindorm-io/monorepo/commit/5ec548b14e65f606e6bf480b6af96bb88353a58c))
- **proteus:** add loading field to MetaEmbeddedList with eager/lazy dispatch ([88c2ee7](https://github.com/lindorm-io/monorepo/commit/88c2ee7957246c6bb1368edbc4bb18fa35c5ae92))
- **proteus:** generalise LazyCollection and add installLazyEmbeddedLists ([f005d16](https://github.com/lindorm-io/monorepo/commit/f005d1644904a52f3a460f17426a306b4bc481ea))
- **proteus:** wire lazy embedded-list skip in drivers and cursors ([8daab7f](https://github.com/lindorm-io/monorepo/commit/8daab7ffd4844d52a989374c0629ec691e3ee949))

# [0.4.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/proteus@0.3.0...@lindorm/proteus@0.4.0) (2026-04-01)

### Bug Fixes

- **proteus,pylon:** align with breaker EventEmitter API and hermes v2 exports ([b8d0952](https://github.com/lindorm-io/monorepo/commit/b8d0952f28364af23e6a54186043191890c0e66f))

### Features

- **breaker:** add EventEmitter support and integrate circuit breaker into proteus ([fed0980](https://github.com/lindorm-io/monorepo/commit/fed0980f51fe501024a435cf92b6dbbf4d27af74))

# [0.3.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/proteus@0.2.1...@lindorm/proteus@0.3.0) (2026-03-29)

### Features

- **proteus:** add mock factories for ProteusSource and Repository ([f542a04](https://github.com/lindorm-io/monorepo/commit/f542a041bf65193dd24a753ff41bc5f0b943546d))

## [0.2.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/proteus@0.2.0...@lindorm/proteus@0.2.1) (2026-03-13)

**Note:** Version bump only for package @lindorm/proteus

# 0.2.0 (2026-03-13)

### Bug Fixes

- add missing afterAll teardown in proteus integration tests ([098e73c](https://github.com/lindorm-io/monorepo/commit/098e73cf0e4a1a55ef6867ab5f8deaee17982193))
- add missing MySQL service, fix MongoDB replica set and auth config ([4af2231](https://github.com/lindorm-io/monorepo/commit/4af223104c7e5e88b0b28e9ff9fa40600282c676))
- mock tsx/cjs/api in remaining tests and stabilise error snapshots ([5e12e6a](https://github.com/lindorm-io/monorepo/commit/5e12e6a3ad52c4cee5359e37fa9fff39533f64d2))
- resolve all eslint warnings across entity, message, hermes, and proteus ([a7aaefc](https://github.com/lindorm-io/monorepo/commit/a7aaefcd2ae48901b546fa191e23edf90ecc22c4))
- resolve proteus build errors in stream cursor and index introspection ([689d3b8](https://github.com/lindorm-io/monorepo/commit/689d3b87d4acf08e82c9f35d32f415fd854ed92b))
- use /dev/null/impossible in migration test for cross-platform reliability ([9bdffab](https://github.com/lindorm-io/monorepo/commit/9bdffab45a0f71a6604ffda41549a678c58c9bcf))

### Features

- add proteus package ([0273878](https://github.com/lindorm-io/monorepo/commit/0273878aeeb9af5fda3b4944c10f85302e31a4e6))
