# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.6.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.5.0...@lindorm/types@0.6.0) (2026-05-02)

### Features

- migrate 13 utility packages + drop jest configs from types/enums ([3eab5ab](https://github.com/lindorm-io/monorepo/commit/3eab5ab9d89cd529553a2aded3c311d3f393ca0f))
- **types:** add AbortReason union and WithSignal<T> mixin ([cd116dd](https://github.com/lindorm-io/monorepo/commit/cd116dd9cdd2f7c7faa2ae1b5b915ea7ed97ba12))

# [0.5.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.4.1...@lindorm/types@0.5.0) (2026-04-15)

### Bug Fixes

- **types:** rename OpenIdClaims.birthDate to birthdate ([e019f59](https://github.com/lindorm-io/monorepo/commit/e019f5916bdafda18620998ee5f76803b44a0050))

### Features

- **types:** add DpopSigner contract ([47e6012](https://github.com/lindorm-io/monorepo/commit/47e60128000139905258c6919d2f33e86f6158d1))
- **types:** add RFC 6749 error fields to OpenIdAuthorizeResponseQuery ([e1566fc](https://github.com/lindorm-io/monorepo/commit/e1566fcc60e67a137942eb43702cda95cd17411e))
- **types:** add RFC 8707 resource parameter to OpenIdAuthorizeRequestQuery ([0517f1b](https://github.com/lindorm-io/monorepo/commit/0517f1b58e9ce374b95913eadfc9331819081ae0))

## [0.4.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.4.0...@lindorm/types@0.4.1) (2026-04-01)

**Note:** Version bump only for package @lindorm/types

# [0.4.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.3.4...@lindorm/types@0.4.0) (2026-03-13)

### Features

- **types:** add PredicateBase type ([82a109c](https://github.com/lindorm-io/monorepo/commit/82a109cacfa4a6b81ff1523037c3ea329d0493a6))

## [0.3.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.3.3...@lindorm/types@0.3.4) (2026-02-17)

### Bug Fixes

- **aes:** make CBC HMAC auth tag compliant with RFC 7518 ([7877022](https://github.com/lindorm-io/monorepo/commit/7877022bebdf902ff13996b1032a991356f3760c))

## [0.3.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.3.2...@lindorm/types@0.3.3) (2025-09-18)

### Bug Fixes

- add more predicate operators and move to types ([c86a27a](https://github.com/lindorm-io/monorepo/commit/c86a27a9640ee5a014fc8d65ff556dc5feaff4bb))

## [0.3.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.3.1...@lindorm/types@0.3.2) (2025-07-19)

### Bug Fixes

- remove unnecessary enums ([d0364d9](https://github.com/lindorm-io/monorepo/commit/d0364d97ad0dc621a1020d4ddba8d3a87959838d))

## [0.3.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.3.0...@lindorm/types@0.3.1) (2025-07-10)

### Bug Fixes

- amend types ([f3a93c8](https://github.com/lindorm-io/monorepo/commit/f3a93c899decb91826555bdd1edd35d561c4506a))

# [0.3.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.2.1...@lindorm/types@0.3.0) (2025-06-17)

### Bug Fixes

- add and implement keykit interface ([70762aa](https://github.com/lindorm-io/monorepo/commit/70762aaca51c9fe904121b69b4bc072cdd89c8a2))
- add honorific to profile claims ([0bac153](https://github.com/lindorm-io/monorepo/commit/0bac153b3708613f440855a92d450ad553946feb))
- improve types ([f6ce002](https://github.com/lindorm-io/monorepo/commit/f6ce002e8555c54ba4f12bd67222457fa2bcf90a))
- use common slim entity and align with improved config ([f4094b1](https://github.com/lindorm-io/monorepo/commit/f4094b173f11af4d342ece49d8a3ff72f1846d20))

### Features

- add dsa encoding ([a893601](https://github.com/lindorm-io/monorepo/commit/a8936015a9408733445cdbda8d8b70d633a2330a))
- align sha kit with other crypto kits ([16d6527](https://github.com/lindorm-io/monorepo/commit/16d6527a2a9f4a19fe50ff6718e81f7ea7fec820))
- upgrade key kits ([198956c](https://github.com/lindorm-io/monorepo/commit/198956c5fa276ae192af22cb204b3c2158c74339))

## [0.2.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.2.0...@lindorm/types@0.2.1) (2025-01-28)

**Note:** Version bump only for package @lindorm/types

# [0.2.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.1.4...@lindorm/types@0.2.0) (2024-09-20)

### Bug Fixes

- add deep partial type ([27e36c6](https://github.com/lindorm-io/monorepo/commit/27e36c6acb9838e76dc5871ce6962f55431c6e4d))

### Features

- add jwks and open-id to types ([41783f5](https://github.com/lindorm-io/monorepo/commit/41783f59f5ddfa44b4072031522b2ca8d4646d38))

## [0.1.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.1.3...@lindorm/types@0.1.4) (2024-05-19)

### Bug Fixes

- add aes types ([ff5e5b8](https://github.com/lindorm-io/monorepo/commit/ff5e5b8d5e953bd86845d13639f20da2d1594bd0))
- add crypto types ([a497d4a](https://github.com/lindorm-io/monorepo/commit/a497d4ae5391d4266be0ed3d5c005ca9efd8caaa))

## [0.1.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.1.2...@lindorm/types@0.1.3) (2024-05-10)

### Bug Fixes

- add header type ([ba98ec1](https://github.com/lindorm-io/monorepo/commit/ba98ec12d4733fa36252a3486503d26d5d5a1088))

## [0.1.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.1.1...@lindorm/types@0.1.2) (2024-05-08)

**Note:** Version bump only for package @lindorm/types

## [0.1.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/types@0.1.0...@lindorm/types@0.1.1) (2024-05-08)

### Bug Fixes

- add type ([a7c1235](https://github.com/lindorm-io/monorepo/commit/a7c12359a8931af4d0142fd90c2fc2e139181dee))

# 0.1.0 (2024-05-08)

### Features

- initialise types package ([bb6ae8f](https://github.com/lindorm-io/monorepo/commit/bb6ae8fb16d2e92e9a18932cc9e4042967d6d852))
