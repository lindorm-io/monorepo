# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.9.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.8.0...@lindorm/pylon@0.9.0) (2026-04-19)

### Bug Fixes

- **pylon:** emit zod/v4 import in generate handler template ([41e50a3](https://github.com/lindorm-io/monorepo/commit/41e50a33379dcc6cef4ee8da692dfc2af52b2cea))
- **pylon:** route LindormWorker instances through scan-workers without re-wrapping ([f9c4ca7](https://github.com/lindorm-io/monorepo/commit/f9c4ca73aa81bf0f638be2a895a1ca4ca0089bf1))
- **pylon:** widen @lindorm/\* peer ranges to current workspace versions ([789e1db](https://github.com/lindorm-io/monorepo/commit/789e1dbef6523381210d7ffce5e82c6927bd4b27))

### Features

- **create-pylon:** generate and load a pylon:kek at scaffold time ([eab4f28](https://github.com/lindorm-io/monorepo/commit/eab4f2848ea3d1c4494740d637d3ba65df463bd7))
- **pylon:** add default health check for proteus and iris ([6d2f9f2](https://github.com/lindorm-io/monorepo/commit/6d2f9f2f883d3c760853f616f7d4d3edbbecba47))
- **pylon:** add generate worker command ([48f2dc4](https://github.com/lindorm-io/monorepo/commit/48f2dc4f699878bf30002d10a3b34bc4e2a15a48))
- **pylon:** add tenant-aware webhook dispatch ([b3cda8b](https://github.com/lindorm-io/monorepo/commit/b3cda8babc7eaebc5ec30b12d11655c2f99d0153))
- **pylon:** add webhook error tracking to WebhookSubscription ([5644176](https://github.com/lindorm-io/monorepo/commit/56441769afa65327924376904e6f3abceba82d57))
- **pylon:** expose /.well-known/security.txt per RFC 9116 ([319a466](https://github.com/lindorm-io/monorepo/commit/319a4668ccb6e640659773be44d848c4e388bdc2))
- **pylon:** rotate kryptos under optional root CA and skip expired rows ([d9cb104](https://github.com/lindorm-io/monorepo/commit/d9cb10454d1f7abc9edcf74abd7342d398479557))
- **pylon:** use Edwards curves for internal keys and namespace system purposes ([229472c](https://github.com/lindorm-io/monorepo/commit/229472cf0477e3bcca0ae9c9298fdf99a3df859b))

# [0.8.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.7.0...@lindorm/pylon@0.8.0) (2026-04-15)

### Bug Fixes

- **pylon:** add explicit return types and await worker.stop() ([4cdaae8](https://github.com/lindorm-io/monorepo/commit/4cdaae899942e5879be9dc790b244a673660a2b5))
- **pylon:** auto-detect encrypted cookies with tokenised AES ([a98e876](https://github.com/lindorm-io/monorepo/commit/a98e87653c845af94d60e94a655f1ffa6e5d6902))
- **pylon:** critical auth fixes — expiry, session upsert, CSRF, nonce, redirects ([5300945](https://github.com/lindorm-io/monorepo/commit/5300945bc7c0f2a5661507b5422bf8b0047e26b1))
- **pylon:** fix session cookie decoding in socket connection middleware ([1534eb5](https://github.com/lindorm-io/monorepo/commit/1534eb56cf9f5e604c6fb248e4a10f915625ff07))
- **pylon:** improve workers with logging and error isolation ([4adaa6d](https://github.com/lindorm-io/monorepo/commit/4adaa6d99cd3d1ecd6c88f75940026b3d9a93ea1))
- **pylon:** make socket emitter data argument optional ([2bda475](https://github.com/lindorm-io/monorepo/commit/2bda475fd1ece2d4e9035c4d88ad0a3e533a4294))
- **pylon:** move queue/webhook to CommonOptions, remove as any casts ([0188ced](https://github.com/lindorm-io/monorepo/commit/0188ced6df0d3cac50ec9171241cc4c5c23b3c81))
- **pylon:** read tokenType from verified header ([a83e893](https://github.com/lindorm-io/monorepo/commit/a83e8932253eb365f8be9779369dbd7e824ad4ad))
- **pylon:** register entities and messages on Proteus/Iris sources ([6ee90a4](https://github.com/lindorm-io/monorepo/commit/6ee90a404076fe102b34119e517f3c963c495eb8))
- **pylon:** revert error handler to pass through full query params ([9babfca](https://github.com/lindorm-io/monorepo/commit/9babfca8e327dee677137e50dc0f5ad508fc66f5))

### Features

- **pylon:** add .kid sibling cookie for signed cookies ([b1a4962](https://github.com/lindorm-io/monorepo/commit/b1a4962db93366fe5774ad88b460fadac16cfbc1))
- **pylon:** add audit log Iris consumer and export entity ([26221fb](https://github.com/lindorm-io/monorepo/commit/26221fbd3a44ed41423dfc887e3d548368ddca9c))
- **pylon:** add auth-state pure utilities ([1ae4558](https://github.com/lindorm-io/monorepo/commit/1ae4558ffb2479e5510a23230f803d74fb5c970f))
- **pylon:** add CLI with init and generate commands ([9a56fbf](https://github.com/lindorm-io/monorepo/commit/9a56fbf349f4ce75d12d5c9395b95de75675ead1))
- **pylon:** add connection chain middleware factories ([d28a3d1](https://github.com/lindorm-io/monorepo/commit/d28a3d1fb3f0eeefc9fbd1ecf038d29f0f0eabff))
- **pylon:** add createConnectionSessionMiddleware ([f7c6893](https://github.com/lindorm-io/monorepo/commit/f7c6893126722b6c4d7db672719f32b56c5d2377))
- **pylon:** add createHandshakeTokenMiddleware ([dd965b3](https://github.com/lindorm-io/monorepo/commit/dd965b39ce9f4fb50f38171fbb07bf2a8134f4cb))
- **pylon:** add data-level audit via Proteus entity events ([bf56233](https://github.com/lindorm-io/monorepo/commit/bf56233014f27b99b93bcdcb5670fb26fa2bcceb))
- **pylon:** add handshake DPoP match adapter ([a21949e](https://github.com/lindorm-io/monorepo/commit/a21949e0642d6e08e52eac50fbe3768dc207c468))
- **pylon:** add public convenience middleware and unify transport-specific middleware ([8ca1037](https://github.com/lindorm-io/monorepo/commit/8ca103759cbd2c5bbe7e0f3977d90c35ddb28b1e))
- **pylon:** add PylonConnectionMiddleware type and handshake context ([5bb85fe](https://github.com/lindorm-io/monorepo/commit/5bb85feb121436191726c04822eeba87926c8c03))
- **pylon:** add refresh handler builders ([5fee470](https://github.com/lindorm-io/monorepo/commit/5fee47043522a2e6dbce4cf252f06bb4a698e8f5))
- **pylon:** add session cookie safety assertions ([303135c](https://github.com/lindorm-io/monorepo/commit/303135cc0f77d4b91049c5419b1842ddcf0b965c))
- **pylon:** add session identity and userinfo/introspection error types ([18adbd7](https://github.com/lindorm-io/monorepo/commit/18adbd72ba667b7fcc5e5807979436c731f987ee))
- **pylon:** add token source resolvers ([5ec3959](https://github.com/lindorm-io/monorepo/commit/5ec3959620e5b27cc0ac0e6a0b6f506de7e79632))
- **pylon:** add webhook Iris consumers, method field, and export entity ([e0ec22c](https://github.com/lindorm-io/monorepo/commit/e0ec22c633599473fda91a1c310fb68e3c664f58))
- **pylon:** auto-inject ctx.rooms via lazyFactory, auto-register built-in room handlers ([c233c56](https://github.com/lindorm-io/monorepo/commit/c233c56149ad7dd085ddc942e7d65db80ec8cc18))
- **pylon:** auto-register $pylon/auth/refresh listener ([ed9b4bc](https://github.com/lindorm-io/monorepo/commit/ed9b4bc6e4f896e0bcc7091006e9944067c2ed6a))
- **pylon:** auto-wire connection session middleware in PylonIo ([b4d83af](https://github.com/lindorm-io/monorepo/commit/b4d83afcb37fed8826011874222f3eb18537ebec))
- **pylon:** encrypt kryptos private keys at rest with @Encrypted + @AppendOnly ([93534fd](https://github.com/lindorm-io/monorepo/commit/93534fd21d8316ec1f25116748285a17bae807e0))
- **pylon:** enforce DPoP at handshake token middleware ([75f7329](https://github.com/lindorm-io/monorepo/commit/75f73299b329f766f507a5b9a5e547b60fbeea5b))
- **pylon:** fix socket error handling and add ack/nack support ([b757e02](https://github.com/lindorm-io/monorepo/commit/b757e02f48f4cef9638fe73aac431ae856469291))
- **pylon:** handle DPoP-bound access tokens in access token middleware ([76d65db](https://github.com/lindorm-io/monorepo/commit/76d65db6fd12ac72a69e6f105da312cb75c84a40))
- **pylon:** integrate Iris for messaging, remove entity-based queue ([b719a86](https://github.com/lindorm-io/monorepo/commit/b719a86a4b08c5ce25861425eeeb6f4edbee5b69))
- **pylon:** integrate Proteus for entity persistence ([ea4a707](https://github.com/lindorm-io/monorepo/commit/ea4a707d6f4ddb998a96d2044c6946992a2783e5))
- **pylon:** multi-tenant and scope middleware ([67ba4fa](https://github.com/lindorm-io/monorepo/commit/67ba4fa3fb5b0fe13e6c9904d9b81c92aa7e85c8))
- **pylon:** parameterised socket event matching via EventMatcher trie ([523fd26](https://github.com/lindorm-io/monorepo/commit/523fd26f4656cdfef875f9b256e5f22109f9431c))
- **pylon:** pin cnf.jkt across bearer refresh ([ddf83ba](https://github.com/lindorm-io/monorepo/commit/ddf83bac62ea2d1c9fbd754d3df5ae506bc48280))
- **pylon:** pylon envelope protocol, typed socket payloads, correlation & lifecycle ([27f9b78](https://github.com/lindorm-io/monorepo/commit/27f9b78e19b31e01f6db9f7bb8d4ff7445366380))
- **pylon:** rate limiting middleware with three strategies, rename entities/messages ([c4fbfb6](https://github.com/lindorm-io/monorepo/commit/c4fbfb66f2c154e56f30e04e619876d376a27b2e))
- **pylon:** redesign Kryptos entity with descriptive cert fields and eager embedded lists ([dc16de7](https://github.com/lindorm-io/monorepo/commit/dc16de764b9237d2729d58e9b55d8ddc93817d16))
- **pylon:** remove init command from cli ([7e8a914](https://github.com/lindorm-io/monorepo/commit/7e8a914e66f6ebaf2f8ca1cb2402e3ccdae6c272))
- **pylon:** request-level audit logging via Iris worker queue ([18d4d45](https://github.com/lindorm-io/monorepo/commit/18d4d4537ab54eb5540adc50a24412201626170b))
- **pylon:** require expiresIn in $pylon/auth/refresh bearer payload ([ecac2f1](https://github.com/lindorm-io/monorepo/commit/ecac2f1c00d0661681369c622460d025f84763c1))
- **pylon:** restructure socket context with envelope emitter ([423e614](https://github.com/lindorm-io/monorepo/commit/423e6148268496a299bc2a10e310002588627134))
- **pylon:** room management middleware with optional presence tracking ([44d6503](https://github.com/lindorm-io/monorepo/commit/44d6503e4b73ea377a54703be52969d1cba78839))
- **pylon:** scaffold KEK + amphora bootstrap during pylon init ([777353d](https://github.com/lindorm-io/monorepo/commit/777353d78e23c836cd75082d37191ea03d9b2118))
- **pylon:** scanner overhaul with shared base and new conventions ([475a100](https://github.com/lindorm-io/monorepo/commit/475a100fa451ed4c2d234c7dc4607be2f0e6e82d))
- **pylon:** wire handshake chain into PylonIo ([61e802e](https://github.com/lindorm-io/monorepo/commit/61e802ee8452ead63d6728dc7e521095631c8b03))

# [0.7.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.6.3...@lindorm/pylon@0.7.0) (2026-04-01)

### Bug Fixes

- **proteus,pylon:** align with breaker EventEmitter API and hermes v2 exports ([b8d0952](https://github.com/lindorm-io/monorepo/commit/b8d0952f28364af23e6a54186043191890c0e66f))

### Features

- **breaker:** add EventEmitter support and integrate circuit breaker into proteus ([fed0980](https://github.com/lindorm-io/monorepo/commit/fed0980f51fe501024a435cf92b6dbbf4d27af74))

## [0.6.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.6.2...@lindorm/pylon@0.6.3) (2026-03-29)

**Note:** Version bump only for package @lindorm/pylon

## [0.6.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.6.1...@lindorm/pylon@0.6.2) (2026-03-13)

**Note:** Version bump only for package @lindorm/pylon

## [0.6.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.6.0...@lindorm/pylon@0.6.1) (2026-03-13)

### Bug Fixes

- add missing MySQL service, fix MongoDB replica set and auth config ([4af2231](https://github.com/lindorm-io/monorepo/commit/4af223104c7e5e88b0b28e9ff9fa40600282c676))
- remove deleted KryptosPurpose type from pylon package ([d27b170](https://github.com/lindorm-io/monorepo/commit/d27b17021d6493715881b566cf87c92f745bbf2a))

# [0.6.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.5.1...@lindorm/pylon@0.6.0) (2026-02-17)

### Features

- add time logger to pylon middleware ([8040408](https://github.com/lindorm-io/monorepo/commit/8040408f135cc7bb4406bbdd45341e61cb480726))

## [0.5.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.5.0...@lindorm/pylon@0.5.1) (2025-09-18)

### Bug Fixes

- use instanceof instead of name ([32d7e31](https://github.com/lindorm-io/monorepo/commit/32d7e31a81a0766f2165afc5c1a9106c957b5d6e))

# [0.5.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.4.4...@lindorm/pylon@0.5.0) (2025-07-19)

### Features

- add infrastructure to pylon ([9ef0244](https://github.com/lindorm-io/monorepo/commit/9ef0244b1de2d3c2bf872aff2656bbe6970483f4))

## [0.4.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.4.3...@lindorm/pylon@0.4.4) (2025-07-12)

**Note:** Version bump only for package @lindorm/pylon

## [0.4.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.4.2...@lindorm/pylon@0.4.3) (2025-07-10)

**Note:** Version bump only for package @lindorm/pylon

## [0.4.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.4.1...@lindorm/pylon@0.4.2) (2025-07-02)

### Bug Fixes

- update queue and webhook handlers ([13d9d8f](https://github.com/lindorm-io/monorepo/commit/13d9d8f155538504b6ddfa0c1d68835e50502834))

## [0.4.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.4.0...@lindorm/pylon@0.4.1) (2025-06-24)

### Bug Fixes

- add signal listeners for teardown ([f44834e](https://github.com/lindorm-io/monorepo/commit/f44834e95bb502228f5d68144c7a6090be1ff1ce))
- update pylon with better handlers ([9f270f4](https://github.com/lindorm-io/monorepo/commit/9f270f464e49772f51f3d96f35c641a253b1730b))

# [0.4.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.3.0...@lindorm/pylon@0.4.0) (2025-06-17)

### Bug Fixes

- add global worker options type ([32d0f22](https://github.com/lindorm-io/monorepo/commit/32d0f22696becae80bc6886e8463ba053855b820))
- align tokens in state ([8fda3c9](https://github.com/lindorm-io/monorepo/commit/8fda3c9ff65923c382036480bae42d52e93f48e2))
- align with changes to dependencies ([ae6c911](https://github.com/lindorm-io/monorepo/commit/ae6c911e5494a252f11f66b948be0e11d7fc91ed))
- allow for dynamic openid config ([c5ea972](https://github.com/lindorm-io/monorepo/commit/c5ea972260cf94f2e8364b6b03467c58aa5505fa))
- allow proxy headers by default ([892be64](https://github.com/lindorm-io/monorepo/commit/892be6427d53b76eacbe0fa701fe5949798927a0))
- allow schema handler to coerce values ([350f06f](https://github.com/lindorm-io/monorepo/commit/350f06f398d9583111324665253082f00ec9202d))
- amend bugs ([a68a77a](https://github.com/lindorm-io/monorepo/commit/a68a77a811ddfe33a0b487cd84cda6a18d3054b6))
- amend error in example ([c320566](https://github.com/lindorm-io/monorepo/commit/c320566998d013a82e2590d227d0d1c6253af3e8))
- automatically encode cookie objects ([c0bee5d](https://github.com/lindorm-io/monorepo/commit/c0bee5da4287d78d8153f8c233fe9db99529dc7d))
- cookie encryption should be handled by aegis ([cdb6218](https://github.com/lindorm-io/monorepo/commit/cdb6218190e706502dc892b988eb944059bba49d))
- correctly parse content-type encoding ([8037aed](https://github.com/lindorm-io/monorepo/commit/8037aed8064a2d0a7c914e4689eed376fccf262b))
- improve cookie options ([62a056c](https://github.com/lindorm-io/monorepo/commit/62a056c306a5034a29f3a4e54c696317d1ce9515))
- improve middleware and their ordering ([dd77ff1](https://github.com/lindorm-io/monorepo/commit/dd77ff125a60466ce7638f5f92c96b16b50417b8))
- make method private ([67f83d3](https://github.com/lindorm-io/monorepo/commit/67f83d31f730c0a4cf5254459be8915e1ff18a71))
- merge domain with issuer for ease of understanding ([9123cc2](https://github.com/lindorm-io/monorepo/commit/9123cc2ede63962a5c226a9bed0d0541001384d9))
- move state into context state ([754bc5f](https://github.com/lindorm-io/monorepo/commit/754bc5f17210ab1e07957d016ee931dbdcfda122))
- require encoding for cookie objects ([e585d18](https://github.com/lindorm-io/monorepo/commit/e585d1859173fe04404afbaadb9eb29337a54c0a))
- resolve errors ([f7ae1a3](https://github.com/lindorm-io/monorepo/commit/f7ae1a3bbbc9e70c4e2244b0f2f3575a5912b6cb))
- scan and load workers into pylon ([171b990](https://github.com/lindorm-io/monorepo/commit/171b9902467386397f455166e092d6dfb10ff5f5))
- update default body parser config ([9c8b1fa](https://github.com/lindorm-io/monorepo/commit/9c8b1fabf8ffffba8dc4f5c6d440ca856eb13e58))
- update dependency ([06c7166](https://github.com/lindorm-io/monorepo/commit/06c716612867438193eb58d3c9e4492d24dc2d24))
- update middleware and move specific handlers into options ([b6d06a3](https://github.com/lindorm-io/monorepo/commit/b6d06a301ef6b0ed57ab281376c155c03a05aa5c))
- use signature kit for pylon cookie kit ([e0ba22d](https://github.com/lindorm-io/monorepo/commit/e0ba22d1a04f72ecd9c120367097c79bf6da218a))
- used serialised aes object for encrypted cookie ([309e65a](https://github.com/lindorm-io/monorepo/commit/309e65a1e0146fc0ba63b97fee9a315afc6adcce))

### Features

- add amphora refresh worker ([f1d5e45](https://github.com/lindorm-io/monorepo/commit/f1d5e457c0dbfde669f3d5da6b6d431f59caa60e))
- add authorization state and improve affected mw ([7af6060](https://github.com/lindorm-io/monorepo/commit/7af6060742ef0a52b71a7f12f1af00f6202bc525))
- add conduit signed request middleware ([1503004](https://github.com/lindorm-io/monorepo/commit/150300412f6dd2dd7a8ade34516db7db4e1cdb2b))
- add default pylon-configuration endpoint ([82f6960](https://github.com/lindorm-io/monorepo/commit/82f6960ca58f4fa80aadaa1ea00f1b46738cf1a4))
- add location data to handler ([22ea5e6](https://github.com/lindorm-io/monorepo/commit/22ea5e6274674c2f7ba7ff66cd003c3f9d73efbd))
- add method to only start workers ([b2fa2c5](https://github.com/lindorm-io/monorepo/commit/b2fa2c5635681aa4e7db62370329435a4b4e2b91))
- add util to get cookie keys ([3ad99da](https://github.com/lindorm-io/monorepo/commit/3ad99dad4f76815b4006d9ba736739c0206d9e2d))
- expand session middleware with store and functions ([6e0b46d](https://github.com/lindorm-io/monorepo/commit/6e0b46db15268cacc10028d1cb59add9bf045eb2))
- handle cookies and signatures in new kit ([eb736eb](https://github.com/lindorm-io/monorepo/commit/eb736eb09e7651b14c75ed77a853af7a902e50ff))
- implement auth router ([7bbf293](https://github.com/lindorm-io/monorepo/commit/7bbf2932a1b8b4fc178b76983e8ed317110252bd))
- implement signed request middleware ([836444d](https://github.com/lindorm-io/monorepo/commit/836444d45db794a748b789015cc8f0bcad9db2b4))

# [0.3.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.2.2...@lindorm/pylon@0.3.0) (2025-01-28)

### Bug Fixes

- add keys to koa constructor ([0bf58f4](https://github.com/lindorm-io/monorepo/commit/0bf58f4ef7bbb3fc1b56d3c5d4ad71518cc02539))
- add origin to metadata ([c8a2412](https://github.com/lindorm-io/monorepo/commit/c8a24122222cb581b7010bd2305db628585cda68))
- always log service response ([a27c4f7](https://github.com/lindorm-io/monorepo/commit/a27c4f7b799c59fc90c77b2dc59fbe6c009de248))
- amend bugs and issues in cors middleware ([b03a8f1](https://github.com/lindorm-io/monorepo/commit/b03a8f1faba07ae2c0114dfaeeed24c4cb36b612))
- clean up options during server init ([35b9a90](https://github.com/lindorm-io/monorepo/commit/35b9a900bde71da49dbfca15ee833b2844d83dfa))
- improve returned error data ([c4a4e0d](https://github.com/lindorm-io/monorepo/commit/c4a4e0d143f203c66c15d929099b8d4beac7c548))
- load cors mw on options method ([28ab40d](https://github.com/lindorm-io/monorepo/commit/28ab40d38694a3325485de8a79487fa31faf5677))
- make setup safer ([59a7b21](https://github.com/lindorm-io/monorepo/commit/59a7b215560ca367fd0a32a1ea0456381200f9c1))
- only set cors headers when cors origin is set ([a94a77c](https://github.com/lindorm-io/monorepo/commit/a94a77c67c002bdf00bc043d3087fffe0f1e7631))
- rename factory function ([8823efd](https://github.com/lindorm-io/monorepo/commit/8823efd2f8ad72e15cf1d95de7a084065f290aaa))
- set headers on error ([a105675](https://github.com/lindorm-io/monorepo/commit/a10567564435ce54f3cabfe995d517b79fdfafa0))
- solve bug in response middleware ([d97bda2](https://github.com/lindorm-io/monorepo/commit/d97bda2aebf5ef3f1bc73995691cbcc69b1dd9ab))
- solve bug in session logger ([b7b0ef9](https://github.com/lindorm-io/monorepo/commit/b7b0ef9b7e4eaff1c3b6aba2b7f8b99c5cf0c618))

### Features

- add cors middleware ([92c9db6](https://github.com/lindorm-io/monorepo/commit/92c9db6e237c351324170b27a4aa6e0aea9d9d9f))
- add cors to pylon options ([560e349](https://github.com/lindorm-io/monorepo/commit/560e34967359d2f0c93a5b9345f276bcfffa96dc))
- add further cors options and functions ([83867b9](https://github.com/lindorm-io/monorepo/commit/83867b94d979c2bd7803250c53b6a56e7d66264a))
- add suspicious date header handling ([2205d0e](https://github.com/lindorm-io/monorepo/commit/2205d0e33c016bcb4cf7d6b6ef4bea10160b2fb4))
- improve entity middleware to accept object as path arg ([1506f7e](https://github.com/lindorm-io/monorepo/commit/1506f7e5ab4cd90866916c4b151e61becb27dc06))

## [0.2.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.2.1...@lindorm/pylon@0.2.2) (2024-10-12)

**Note:** Version bump only for package @lindorm/pylon

## [0.2.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.2.0...@lindorm/pylon@0.2.1) (2024-10-09)

### Bug Fixes

- align imports ([e6a77ce](https://github.com/lindorm-io/monorepo/commit/e6a77ceb096100007f38a58e36f607ca5994136a))

# [0.2.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.1.1...@lindorm/pylon@0.2.0) (2024-09-25)

### Bug Fixes

- export files type ([8405f8c](https://github.com/lindorm-io/monorepo/commit/8405f8cb4f687cd7c5a548b9ac90c0f84c76691b))
- use correct utils ([76af967](https://github.com/lindorm-io/monorepo/commit/76af967bbba6a916549209f5f911d46f5447cf00))
- use environment from enums ([fcaaae1](https://github.com/lindorm-io/monorepo/commit/fcaaae177cd632c01a8d82af991317baa906b7de))

### Features

- add basic auth middleware ([4bcba52](https://github.com/lindorm-io/monorepo/commit/4bcba52372a73aaffba023bc8de2d23b6c2434ce))

## [0.1.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/pylon@0.1.0...@lindorm/pylon@0.1.1) (2024-09-23)

**Note:** Version bump only for package @lindorm/pylon

# 0.1.0 (2024-09-20)

### Bug Fixes

- amend errors in examples ([da82d68](https://github.com/lindorm-io/monorepo/commit/da82d68c8b53d274f3e37ff3853a2455fda1302c))
- update eslint config ([0d64d3f](https://github.com/lindorm-io/monorepo/commit/0d64d3ffed42ce6472c81865facf33e8fd66a2d2))

### Features

- initialise pylon package ([f80a6c7](https://github.com/lindorm-io/monorepo/commit/f80a6c783e1802ac60547844937948ce9b6af574))
