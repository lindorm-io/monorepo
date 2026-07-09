# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.12.0 (2026-07-09)

### Bug Fixes

- add missing afterAll teardown in proteus integration tests ([fd32c35](https://github.com/lindorm-io/monorepo/commit/fd32c356b6a6eefeec980ec6bb0dae9c5f4b5b26))
- add missing MySQL service, fix MongoDB replica set and auth config ([70da3d6](https://github.com/lindorm-io/monorepo/commit/70da3d6ca50f4df6e5efc8f0df331c7289362234))
- declare zod as a peerDependency on packages with zod-typed public APIs ([790bc68](https://github.com/lindorm-io/monorepo/commit/790bc689aa8e9450f74c3e880cbe3825a0d680ae))
- **eslint:** forbid redundant public via explicit-member-accessibility no-public ([e759b1f](https://github.com/lindorm-io/monorepo/commit/e759b1f1c552b50d150aecca51488eac64856d91))
- **esm:** switch ioredis imports to named Redis export ([dc2cb8a](https://github.com/lindorm-io/monorepo/commit/dc2cb8a47f999996482bbaf2a4a2fa12effe5287))
- mock tsx/cjs/api in remaining tests and stabilise error snapshots ([678e210](https://github.com/lindorm-io/monorepo/commit/678e2101c6f6b00be632b49f2de90a8b061f9c9e))
- **packages:** declare files: ["dist"] for every publishable package ([b8d29fc](https://github.com/lindorm-io/monorepo/commit/b8d29fc24996a02636ddecc11c5d25da4930ef11))
- **proteus,iris,hermes:** simplify logger in init templates ([79df6d8](https://github.com/lindorm-io/monorepo/commit/79df6d889f945c3731a83974d2ba96e6565cd26b))
- **proteus,pylon:** align with breaker EventEmitter API and hermes v2 exports ([3f5856a](https://github.com/lindorm-io/monorepo/commit/3f5856aa1232347f4c266795a7559d58256896b9))
- **proteus:** add explicit return type to emitEntity default ([f59239e](https://github.com/lindorm-io/monorepo/commit/f59239ede3aa08cb4fabd27c04e4bae65fb19913))
- **proteus:** align postgres cursor code with other drivers ([71c3782](https://github.com/lindorm-io/monorepo/commit/71c378262d86ed297e62fa1d750497e3eeeb6dd9))
- **proteus:** apply the naming strategy to @Embedded columns ([37d60dd](https://github.com/lindorm-io/monorepo/commit/37d60dde04c39e8ad4231f1590b3aad06e48937c))
- **proteus:** check mysql signal.aborted after successful tx-scoped query ([1157ddb](https://github.com/lindorm-io/monorepo/commit/1157ddbb3c22e4f5d5a2d7f4ec3828ca2b4d23c0))
- **proteus:** decimal hydrates as a number with round-trip fidelity ([c0a6dd0](https://github.com/lindorm-io/monorepo/commit/c0a6dd0c9524370313d4799c974568e975d26c10))
- **proteus:** decrypt @Encrypted fields by exact kid, not predicate ([4f1b5ff](https://github.com/lindorm-io/monorepo/commit/4f1b5ff700ffa8870e0ac122cba6b4ac143e135c))
- **proteus:** default @RelationCount columns to 0 ([e597934](https://github.com/lindorm-io/monorepo/commit/e597934312ad3ca04e49eb8b6ff3cc910fcd8ec7))
- **proteus:** derive owning FK from the relation object in create() ([df9ec0d](https://github.com/lindorm-io/monorepo/commit/df9ec0d4a5183b71ef1e9408144783747c5b958e))
- **proteus:** enforce @ReadOnly("update") on redis and mongo ([5f4b603](https://github.com/lindorm-io/monorepo/commit/5f4b6037296d0b9cb8a655024a8b4cc5e96b1c13))
- **proteus:** extend the orderBy guard to memory/redis/mongo find ([3abe830](https://github.com/lindorm-io/monorepo/commit/3abe83072b5f71803b60fabca71de12b023b325f))
- **proteus:** fall back a type-less PK marker to VARCHAR(255) ([dc2b955](https://github.com/lindorm-io/monorepo/commit/dc2b95583528713e4fe729653edf45ce3dd319da))
- **proteus:** guard increment/decrement of encrypted fields ([439c773](https://github.com/lindorm-io/monorepo/commit/439c773764d18a83022626891d3601d5113bf8d5))
- **proteus:** honor an explicit column name equal to the property key ([9ba93d0](https://github.com/lindorm-io/monorepo/commit/9ba93d06369c5166794cb45b645e7053e373cfea))
- **proteus:** honor upsert conflictOn across memory, postgres, and mysql ([b69f6ae](https://github.com/lindorm-io/monorepo/commit/b69f6aec9b0a0b5c5b475d5f39159eb47e90b2e1))
- **proteus:** improve init source template ([4623faf](https://github.com/lindorm-io/monorepo/commit/4623faf3bb7016c39f68d69c33a4f012a09fe193))
- **proteus:** make postgres jsonb-backed array fields work end-to-end ([f7cd4a9](https://github.com/lindorm-io/monorepo/commit/f7cd4a9c75548ac6e628024ad75d7207140fa211))
- **proteus:** polyfill Symbol.metadata at package entry ([7891f72](https://github.com/lindorm-io/monorepo/commit/7891f7212afee2cf3cd751adf8e5041da70bdeca))
- **proteus:** preserve binary and 64-bit bigint fidelity on read ([381c10f](https://github.com/lindorm-io/monorepo/commit/381c10fe179672350d871e23895f4f426dddf0d1))
- **proteus:** regenerate version keys with their own @Generated strategy ([649832c](https://github.com/lindorm-io/monorepo/commit/649832c3126b2853076af08c39f55a84242bcb17))
- **proteus:** reject field initializers on lazy @EmbeddedList fields at metadata build ([2cf7228](https://github.com/lindorm-io/monorepo/commit/2cf722874ef0be283f991f657189bf2c36c1671f))
- **proteus:** reject the keyset `orderBy` key on offset finds (was a silent no-op) ([4f50e44](https://github.com/lindorm-io/monorepo/commit/4f50e4409dbefc6f735aa2fca112ead151fa7ea9))
- **proteus:** reject unknown fields during entity validation ([e90a754](https://github.com/lindorm-io/monorepo/commit/e90a754af8082ddf2ea350290aaa1820980de0c5))
- **proteus:** resolve naming strategy across relation/inheritance metadata ([0ecae5a](https://github.com/lindorm-io/monorepo/commit/0ecae5a979320c3c7e457d90728359e2f217d8e7))
- **proteus:** restore stripped non-null assertions in executeQueryIncludes ([e94070c](https://github.com/lindorm-io/monorepo/commit/e94070ccc84966b05e4a387e5f2fa7d9a49e9434))
- **proteus:** serialize Promise.all on single-connection clients ([bc5c02e](https://github.com/lindorm-io/monorepo/commit/bc5c02efd983afd4cf78406576435c92efd3d530))
- **proteus:** typecheck cleanup ([42969bb](https://github.com/lindorm-io/monorepo/commit/42969bbad852a4f2aee2294e9f748a1e733fd956))
- **proteus:** update ioredis mock for ESM named Redis export ([252a85d](https://github.com/lindorm-io/monorepo/commit/252a85d18510e0f223ba6a84e4d1306fdf23f125))
- **proteus:** use naming-resolved metadata in repository upsert ([1ee8568](https://github.com/lindorm-io/monorepo/commit/1ee8568f1986f62bbf4df908118a3bb2bc9476ca))
- **proteus:** use positional filter in test:integration script ([166c3f2](https://github.com/lindorm-io/monorepo/commit/166c3f2acba80c5bd6334704be1a65b8f5f70b99))
- **proteus:** widen @lindorm/\* peer ranges to current workspace versions ([f950b88](https://github.com/lindorm-io/monorepo/commit/f950b886c90120df690e00a5d6b131b074697f1d))
- resolve all eslint warnings across entity, message, hermes, and proteus ([587e717](https://github.com/lindorm-io/monorepo/commit/587e7171d2d628ca3d731236f5bb711c2b14afbf))
- resolve proteus build errors in stream cursor and index introspection ([1758dfe](https://github.com/lindorm-io/monorepo/commit/1758dfef9a94ced64da4ba116fc58a369c3eedf5))
- **scaffold:** start @lindorm/scaffold at 0.0.0 ([643853c](https://github.com/lindorm-io/monorepo/commit/643853c9321f8da8156d665969a6cf5ea2cb3845))
- use /dev/null/impossible in migration test for cross-platform reliability ([1c0db94](https://github.com/lindorm-io/monorepo/commit/1c0db94db8cbc9f506254cd8ae6a452742ac61b2))
- widen @lindorm/\* peer ranges to unbounded >= ([9655dec](https://github.com/lindorm-io/monorepo/commit/9655dec5ce8d66b4691faa98352980bef11a466e))

### Features

- add proteus package ([a4bf832](https://github.com/lindorm-io/monorepo/commit/a4bf832419933ddca69d399ffdc32cd67c263243))
- **breaker:** add EventEmitter support and integrate circuit breaker into proteus ([8fb8474](https://github.com/lindorm-io/monorepo/commit/8fb8474477ecfccfc22114c637bda794a6f38ebc))
- **proteus:** @TypedJson — lossless json/jsonb via a sidecar type-meta column ([b1facb0](https://github.com/lindorm-io/monorepo/commit/b1facb0b086288b8f737abd781795db91c7db563))
- **proteus:** add @AppendOnly decorator with SQL trigger enforcement ([89efe2a](https://github.com/lindorm-io/monorepo/commit/89efe2aac0dc8d328448e9bc8ad4d501ea99a30d))
- **proteus:** add client<T>() escape hatch to ITransactionContext ([470ee29](https://github.com/lindorm-io/monorepo/commit/470ee295ef9f97fca4b81e17a0ee29069b876a6e))
- **proteus:** add hasEntity introspection to repository provider ([cb0a549](https://github.com/lindorm-io/monorepo/commit/cb0a5491e3596a52a70f0f9f1c86f5f2d068abab))
- **proteus:** add init and generate entity CLI commands ([bb77c68](https://github.com/lindorm-io/monorepo/commit/bb77c68e1178d0d65d6f35d3ed2fef0d4f7d665d))
- **proteus:** add IProteusSource interface ([1839655](https://github.com/lindorm-io/monorepo/commit/1839655ec4de144b3c81df3b0ef1b561112aa155))
- **proteus:** add lindorm_id strategy and function form to @Generated ([fe481a8](https://github.com/lindorm-io/monorepo/commit/fe481a8f6b7c426047b14be7131802db08efa3b3))
- **proteus:** add loading field to MetaEmbeddedList with eager/lazy dispatch ([11cbe22](https://github.com/lindorm-io/monorepo/commit/11cbe2203343b5024b9ce6168850c10a6da88af6))
- **proteus:** add mock factories for ProteusSource and Repository ([4a67275](https://github.com/lindorm-io/monorepo/commit/4a67275afba1429dd49157931267333aecadf970))
- **proteus:** add queryBuilder.orderByRaw for raw ORDER BY expressions ([c261296](https://github.com/lindorm-io/monorepo/commit/c2612960095599be6263357fedf0366b869225d8))
- **proteus:** add titles and details to thrown errors ([9bf8e1b](https://github.com/lindorm-io/monorepo/commit/9bf8e1b1a3e1d1041f1290a7830a50483bfb6be5))
- **proteus:** bound synchronize lock wait; make sync progress visible ([9ae6e79](https://github.com/lindorm-io/monorepo/commit/9ae6e79e193f604e3c50904d88a46d3f83529588))
- **proteus:** emulate referential integrity in the memory driver ([9cde7b6](https://github.com/lindorm-io/monorepo/commit/9cde7b6e2f7de105086d3bae6ef5fec1f8d8824a))
- **proteus:** enable lindorm_id primary keys and add generation guards ([b715557](https://github.com/lindorm-io/monorepo/commit/b7155570b60567169d47e2cf5616c1a5b931848b))
- **proteus:** enrich driver error throws with codes ([2482b1a](https://github.com/lindorm-io/monorepo/commit/2482b1afd2c04f2ef0ea3dcb3fc2e59529f7fd89))
- **proteus:** expose snapshot opt-out on FindOptions and PaginateOptions ([b5dad30](https://github.com/lindorm-io/monorepo/commit/b5dad30c61fa0898f9d15982bcae58c37c2bef4a))
- **proteus:** extend generateSource with configImport and cache options ([8180c31](https://github.com/lindorm-io/monorepo/commit/8180c313c2e6b9aaee3b1f24b5e685942dc855b2))
- **proteus:** finish enriching errors (mongo, entity, utils, cli) ([d025c76](https://github.com/lindorm-io/monorepo/commit/d025c765a9e7adeb05f2b2c2152b2aa89409b35a))
- **proteus:** first-class pg_trgm fuzzy text search (PostgreSQL) ([8e444bb](https://github.com/lindorm-io/monorepo/commit/8e444bbdfc84b84059261f15c958a6f792afb121))
- **proteus:** forward session signal to mongo operations ([3b48ad1](https://github.com/lindorm-io/monorepo/commit/3b48ad154f05fba351d2ca90352dea9dc5d69934))
- **proteus:** generalise LazyCollection and add installLazyEmbeddedLists ([488b11e](https://github.com/lindorm-io/monorepo/commit/488b11eb97bf8fd097c406aac8aff348102f7dcf))
- **proteus:** make seeded mocks a stateful in-memory store ([7edc5af](https://github.com/lindorm-io/monorepo/commit/7edc5af5473e77fe4bdc57f7b1c56bf13353474f))
- **proteus:** migrate tests from jest to vitest ([c48ab79](https://github.com/lindorm-io/monorepo/commit/c48ab79b489fcff62ad3fcd5207217430880abdc))
- **proteus:** namespace errors, begin throw enrichment ([c4b0f61](https://github.com/lindorm-io/monorepo/commit/c4b0f61fa854e21060ec8e0843b3a61398d56c79))
- **proteus:** namespace on @Generated("lindorm_id"); size varchar to the id ([cd8c352](https://github.com/lindorm-io/monorepo/commit/cd8c352f2b183a858a29034fc853b6e69d075ddc))
- **proteus:** pre-flight + race-based redis session signal handling ([cfe9749](https://github.com/lindorm-io/monorepo/commit/cfe97491691b313858696b176242e88766b30820))
- **proteus:** reject unserialisable types in plain json fields (Phase 3) ([982d063](https://github.com/lindorm-io/monorepo/commit/982d063c53fb20ee06b1eebcabc8b44bb67f1def))
- **proteus:** resolve init/entity dirs via lindorm.config ([73b2b75](https://github.com/lindorm-io/monorepo/commit/73b2b75e2efe49ca797c2b939d2652df3fbf9002))
- **proteus:** round-trip typed arrays symmetrically across all drivers ([dcaa25d](https://github.com/lindorm-io/monorepo/commit/dcaa25d3622a176a2273899d2db1249c49671a31))
- **proteus:** scaffold sources export the driver name, not `source` ([4a8e058](https://github.com/lindorm-io/monorepo/commit/4a8e05824978c4b849c27d4271bc1a0b2387e305))
- **proteus:** scope @ReadOnly() to update and/or upsert ([a87d3cf](https://github.com/lindorm-io/monorepo/commit/a87d3cfe32114f68e95ea9d059aa8d6e9a83f37d))
- **proteus:** seed mock proteus with rows for faithful read queries ([5537f0a](https://github.com/lindorm-io/monorepo/commit/5537f0a8bb20f9d3c0f6c6a1b89b9ab21561f12d))
- **proteus:** store session signal on memory driver ([e7f5f67](https://github.com/lindorm-io/monorepo/commit/e7f5f673fde74268d247400929abf92b390c4d6a))
- **proteus:** store session signal on sqlite driver ([e950d5a](https://github.com/lindorm-io/monorepo/commit/e950d5a4ea65f9cde940b8b3bda06edde65a16ee))
- **proteus:** support amphoraImport in generateSource and writeSource ([2b6e3eb](https://github.com/lindorm-io/monorepo/commit/2b6e3ebd09919f1434e8ef2731c9931aca3376f5))
- **proteus:** support naming and config-driven sync flags in generateSource ([a4955a4](https://github.com/lindorm-io/monorepo/commit/a4955a45466b5638623789482b5e34538e5fa5aa))
- **proteus:** thread AbortSignal through session and query options ([ed8cbdc](https://github.com/lindorm-io/monorepo/commit/ed8cbdca04503c174c9f29d45d713c26c70b3b84))
- **proteus:** wire lazy embedded-list skip in drivers and cursors ([54873b2](https://github.com/lindorm-io/monorepo/commit/54873b2e93616f605b1757879e11f5cf659a5e2b))
- **proteus:** wire mysql session signal cancellation via KILL QUERY ([3e8063f](https://github.com/lindorm-io/monorepo/commit/3e8063f6aea8bac6eba3d2e1c321049914169706))
- **proteus:** wire Tier 3 pg query cancellation via pg_cancel_backend ([9647ffe](https://github.com/lindorm-io/monorepo/commit/9647ffe822be5eb2d65b6a56dea9953ad054c75a))
- **test:** shared vitest base config + remove proteus jest config ([018ddbc](https://github.com/lindorm-io/monorepo/commit/018ddbcb5bfe14e3c019a0135d49ff5a05020c12))

# [0.11.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/proteus@0.10.0...@lindorm/proteus@0.11.0) (2026-07-04)

### Features

- **proteus:** add queryBuilder.orderByRaw for raw ORDER BY expressions ([0d0b5ab](https://github.com/lindorm-io/monorepo/commit/0d0b5abf48b8e25951faba1c57e42a0a0c51ae8d))
- **proteus:** round-trip typed arrays symmetrically across all drivers ([d4b25c6](https://github.com/lindorm-io/monorepo/commit/d4b25c6098ff594d07bf833682ee25583d6ba0e1))

# [0.10.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/proteus@0.9.0...@lindorm/proteus@0.10.0) (2026-07-02)

### Bug Fixes

- declare zod as a peerDependency on packages with zod-typed public APIs ([eb46f80](https://github.com/lindorm-io/monorepo/commit/eb46f802ccaacf92a06250440edd7df97b57e5e6))
- **eslint:** forbid redundant public via explicit-member-accessibility no-public ([0ca0e95](https://github.com/lindorm-io/monorepo/commit/0ca0e953509d6d28baabcbc5233c1a17e6e6efa0))
- **proteus:** decimal hydrates as a number with round-trip fidelity ([ec8fe37](https://github.com/lindorm-io/monorepo/commit/ec8fe37ceccd9a72f710caeb8fde14fad3f9ab04))
- **proteus:** default @RelationCount columns to 0 ([bcfe3ba](https://github.com/lindorm-io/monorepo/commit/bcfe3ba1f1b86e3f7a4c002c02f6239e47c2b01b))
- **proteus:** derive owning FK from the relation object in create() ([eb69552](https://github.com/lindorm-io/monorepo/commit/eb695527c0fdc60a2ea6116b47def44f301c7251))
- **proteus:** extend the orderBy guard to memory/redis/mongo find ([2efbcfd](https://github.com/lindorm-io/monorepo/commit/2efbcfdce895b1aa6d9379dac269d715566e6b9c))
- **proteus:** make postgres jsonb-backed array fields work end-to-end ([5bc049c](https://github.com/lindorm-io/monorepo/commit/5bc049c095894eea2c52bd2bd214f7d914cae15f))
- **proteus:** reject the keyset `orderBy` key on offset finds (was a silent no-op) ([2cc24f2](https://github.com/lindorm-io/monorepo/commit/2cc24f29107589df53d4ba9d955764bbe8ac3801))
- **proteus:** resolve naming strategy across relation/inheritance metadata ([9984f18](https://github.com/lindorm-io/monorepo/commit/9984f18bd57d7a7234325dfc32276e7dcf4e28ec))
- **proteus:** use naming-resolved metadata in repository upsert ([b9fa3d4](https://github.com/lindorm-io/monorepo/commit/b9fa3d436b0c75c97991b1a6bb0a6729fa652bc3))

### Features

- **proteus:** @TypedJson — lossless json/jsonb via a sidecar type-meta column ([30eb89b](https://github.com/lindorm-io/monorepo/commit/30eb89b1827574cc0293541ea076f74cd6f814ae))
- **proteus:** first-class pg_trgm fuzzy text search (PostgreSQL) ([6f8356c](https://github.com/lindorm-io/monorepo/commit/6f8356ccd5cbf26475792c07785bbb61573c5a65))
- **proteus:** reject unserialisable types in plain json fields (Phase 3) ([632df25](https://github.com/lindorm-io/monorepo/commit/632df25d404f5cd2cf48d9ccb3d623763b200219))

# [0.9.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/proteus@0.8.0...@lindorm/proteus@0.9.0) (2026-06-19)

### Bug Fixes

- **proteus:** fall back a type-less PK marker to VARCHAR(255) ([620ec99](https://github.com/lindorm-io/monorepo/commit/620ec9901dfdaa1aa00fe4f92b6378fd8170289e))
- **proteus:** regenerate version keys with their own @Generated strategy ([8028bd7](https://github.com/lindorm-io/monorepo/commit/8028bd7b3f01bdab1c3068e16470ffaa46690e35))

### Features

- **proteus:** add lindorm_id strategy and function form to @Generated ([2171440](https://github.com/lindorm-io/monorepo/commit/21714402340518d1579ec911a7fc13b2f9bb8bac))
- **proteus:** enable lindorm_id primary keys and add generation guards ([4a5e1bb](https://github.com/lindorm-io/monorepo/commit/4a5e1bb083b705b18dca88ba20f0875701af85bc))
- **proteus:** namespace on @Generated("lindorm_id"); size varchar to the id ([5ef68cb](https://github.com/lindorm-io/monorepo/commit/5ef68cba8a9e8c4529a87663f9cff594802e014a))

# [0.8.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/proteus@0.7.1...@lindorm/proteus@0.8.0) (2026-06-15)

### Bug Fixes

- **proteus:** align postgres cursor code with other drivers ([b0ce86a](https://github.com/lindorm-io/monorepo/commit/b0ce86ac4bec1376c546afec935537b9f8a32ef9))
- **proteus:** guard increment/decrement of encrypted fields ([f2c866f](https://github.com/lindorm-io/monorepo/commit/f2c866f364a887cf48df7a39ddffd127e8540637))
- **proteus:** honor upsert conflictOn across memory, postgres, and mysql ([14a4042](https://github.com/lindorm-io/monorepo/commit/14a4042cae0673ef9074e1f9d09cde572be54d4d))
- **proteus:** preserve binary and 64-bit bigint fidelity on read ([33b58af](https://github.com/lindorm-io/monorepo/commit/33b58afae0ead6f8ef17c8a23a71fd90f9ec1d22))

### Features

- **proteus:** add titles and details to thrown errors ([6c164ca](https://github.com/lindorm-io/monorepo/commit/6c164ca3c23940a7de9137cbc8b5884475a0ca5b))
- **proteus:** emulate referential integrity in the memory driver ([698b08b](https://github.com/lindorm-io/monorepo/commit/698b08b5b6084f826d1463cd2c928d1a4b9e2883))
- **proteus:** enrich driver error throws with codes ([61147fe](https://github.com/lindorm-io/monorepo/commit/61147feda990433ec786aca5e10fad162ba1c30c))
- **proteus:** finish enriching errors (mongo, entity, utils, cli) ([297da06](https://github.com/lindorm-io/monorepo/commit/297da063b65d52de9cb84de035d8a95bfd4ecc43))
- **proteus:** namespace errors, begin throw enrichment ([749299b](https://github.com/lindorm-io/monorepo/commit/749299b1b0fd53bce71f639df0c56700c68b3840))

## [0.7.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/proteus@0.7.0...@lindorm/proteus@0.7.1) (2026-06-05)

**Note:** Version bump only for package @lindorm/proteus

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
