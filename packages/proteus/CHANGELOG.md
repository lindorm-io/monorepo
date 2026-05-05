# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.7.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/proteus@0.6.1...@lindorm/proteus@0.7.0) (2026-05-05)

### Bug Fixes

- **packages:** declare files: ["dist"] for every publishable package ([6fe2ac8](https://github.com/lindorm-io/monorepo/commit/6fe2ac818d0deba7e68f799b7f856c7ebf419832))
- **proteus:** serialize Promise.all on single-connection clients ([7194f02](https://github.com/lindorm-io/monorepo/commit/7194f028f5af9fe8b52cbf38386086e2a372d0cf))

### Features

- **proteus:** support amphoraImport in generateSource and writeSource ([4def80a](https://github.com/lindorm-io/monorepo/commit/4def80a2e48ec8aefbcc2f006f2df7e8cf91f51a))
- **proteus:** support naming and config-driven sync flags in generateSource ([3d69812](https://github.com/lindorm-io/monorepo/commit/3d69812cd66f69068a3b3f76fa479bd9c7631965))

## [0.6.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/proteus@0.6.0...@lindorm/proteus@0.6.1) (2026-05-05)

**Note:** Version bump only for package @lindorm/proteus

# [0.6.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/proteus@0.5.1...@lindorm/proteus@0.6.0) (2026-05-02)

### Bug Fixes

- **esm:** switch ioredis imports to named Redis export ([88e7365](https://github.com/lindorm-io/monorepo/commit/88e7365e0a3e2780087449c34bdb47b886d37ef0))
- **proteus:** check mysql signal.aborted after successful tx-scoped query ([2337f26](https://github.com/lindorm-io/monorepo/commit/2337f26d04f3da7dbe182679540eeb66bc61d659))
- **proteus:** polyfill Symbol.metadata at package entry ([b486ba7](https://github.com/lindorm-io/monorepo/commit/b486ba7df2c9b8e875370cd744b9026f34b4fbd9))
- **proteus:** restore stripped non-null assertions in executeQueryIncludes ([1c9157c](https://github.com/lindorm-io/monorepo/commit/1c9157cf74168cd02b2a406d561e3299d3938936))
- **proteus:** typecheck cleanup ([61b67bd](https://github.com/lindorm-io/monorepo/commit/61b67bdf4da8c8e765d60373f9b04267040368d1))
- **proteus:** update ioredis mock for ESM named Redis export ([d43bb37](https://github.com/lindorm-io/monorepo/commit/d43bb37c1ef1a5d571ee3981a7ba5ea70c5f1a02))
- **proteus:** use positional filter in test:integration script ([13008ae](https://github.com/lindorm-io/monorepo/commit/13008ae09d2c243125eb45b55c8b5b8cbb9a03d2))
- widen @lindorm/\* peer ranges to unbounded >= ([f192b59](https://github.com/lindorm-io/monorepo/commit/f192b59107bf1f276d296837f40fa97765d9d2ba))

### Features

- **proteus:** add client<T>() escape hatch to ITransactionContext ([0db19ce](https://github.com/lindorm-io/monorepo/commit/0db19cee608d7099aa2bdc73e571bd9ee32ff1e6))
- **proteus:** add hasEntity introspection to repository provider ([0a2a52c](https://github.com/lindorm-io/monorepo/commit/0a2a52c3174cb035dd494264460580736f58e041))
- **proteus:** expose snapshot opt-out on FindOptions and PaginateOptions ([9866ab7](https://github.com/lindorm-io/monorepo/commit/9866ab7abe5aec103b9b906caa073f4de9a3468f))
- **proteus:** extend generateSource with configImport and cache options ([cbc7387](https://github.com/lindorm-io/monorepo/commit/cbc7387ccde1d1775048672ec525dbcb6c13f34f))
- **proteus:** forward session signal to mongo operations ([143d78e](https://github.com/lindorm-io/monorepo/commit/143d78e244d1b36a000e61f71eb8259efdeef53d))
- **proteus:** migrate tests from jest to vitest ([74801a6](https://github.com/lindorm-io/monorepo/commit/74801a636ce1936a920032044a52ef64c1aee84a))
- **proteus:** pre-flight + race-based redis session signal handling ([94d15cf](https://github.com/lindorm-io/monorepo/commit/94d15cf650798a6dd13296218878f7fe05bf5c3c))
- **proteus:** store session signal on memory driver ([2644ba7](https://github.com/lindorm-io/monorepo/commit/2644ba713b1ba1d8cb785364f5cd9b94083147c3))
- **proteus:** store session signal on sqlite driver ([8cfa590](https://github.com/lindorm-io/monorepo/commit/8cfa5907fd2f8e3cc71ab535522f7ba8e63b506b))
- **proteus:** thread AbortSignal through session and query options ([01e7ff8](https://github.com/lindorm-io/monorepo/commit/01e7ff8f8fe9d3b3295a865472fa22b1ddc10941))
- **proteus:** wire mysql session signal cancellation via KILL QUERY ([896cac5](https://github.com/lindorm-io/monorepo/commit/896cac5c5d9d3d36dc98ce2697c206dc8c36b8e7))
- **proteus:** wire Tier 3 pg query cancellation via pg_cancel_backend ([b925de8](https://github.com/lindorm-io/monorepo/commit/b925de8176b2b44b2f77fc9179bccfaf37233f8b))
- **test:** shared vitest base config + remove proteus jest config ([964ed32](https://github.com/lindorm-io/monorepo/commit/964ed32c3ebc3ecf153af734ff96222c1e5f9141))

## [0.5.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/proteus@0.5.0...@lindorm/proteus@0.5.1) (2026-04-19)

### Bug Fixes

- **proteus:** reject unknown fields during entity validation ([4ec3eae](https://github.com/lindorm-io/monorepo/commit/4ec3eae3a1959884493404ee3cf3c0a0d9c42263))
- **proteus:** widen @lindorm/\* peer ranges to current workspace versions ([ff3ac90](https://github.com/lindorm-io/monorepo/commit/ff3ac9052534f663cf1e1ef75947f11f1f6bc8b0))

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
