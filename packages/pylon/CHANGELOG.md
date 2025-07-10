# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
