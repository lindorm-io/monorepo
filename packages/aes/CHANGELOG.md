# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.6.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.5.5...@lindorm/aes@0.6.0) (2026-02-17)

### Bug Fixes

- **aes:** add buffer boundary validation in encoded string parser ([579e8f7](https://github.com/lindorm-io/monorepo/commit/579e8f7eb40570f978cd52d1f87f7f8570474d6d))
- **aes:** add GCM auth tag enforcement and key-wrap input validation ([1a8fd3c](https://github.com/lindorm-io/monorepo/commit/1a8fd3cb6f83cf59a3089a777fba4c8b7f1828fb))
- **aes:** add missing @lindorm/utils dependency ([6d0ee2a](https://github.com/lindorm-io/monorepo/commit/6d0ee2ae68f91fb9eb04529c96e05ff1d843dfd0))
- **aes:** make CBC HMAC auth tag compliant with RFC 7518 ([7877022](https://github.com/lindorm-io/monorepo/commit/7877022bebdf902ff13996b1032a991356f3760c))
- **aes:** make PBES2 salt compliant with RFC 7518 ([2693afa](https://github.com/lindorm-io/monorepo/commit/2693afa88db535aeaff7fd5537885dd3a45bc09a))
- **aes:** make verify/assert work with non-string content ([aa94c66](https://github.com/lindorm-io/monorepo/commit/aa94c66511326f70fdfc0245ce12953025aa4236))
- **aes:** remove unnecessary g flag from tokenised regex ([5a989b1](https://github.com/lindorm-io/monorepo/commit/5a989b1d96b025b3180339294e8ea072d215c7d3))
- **aes:** replace generic Error with AesError in all locations ([ff7a08d](https://github.com/lindorm-io/monorepo/commit/ff7a08d55e9b39755e059e31e99fb45b687bdde2))
- **aes:** use Concat KDF per RFC 7518 for ECDH-ES key agreement ([8e92b8f](https://github.com/lindorm-io/monorepo/commit/8e92b8f60ee46c99f0c66af244fd1e7648130a9c))
- **aes:** use crypto.randomInt for PBKDF2 iterations, fix RSA test fixture ([a5457aa](https://github.com/lindorm-io/monorepo/commit/a5457aa5973e4eab662dbc6e62c9470f7d6fabf2))
- **aes:** use oct keys directly for AES key wrap per RFC 7518 ([c65ca49](https://github.com/lindorm-io/monorepo/commit/c65ca49d758f21e868e96512a96fc8df0559947e))
- **aes:** use timingSafeEqual for ECB key unwrap integrity check ([dd27a65](https://github.com/lindorm-io/monorepo/commit/dd27a65c84eed068d6e9e5de34d0eaca6cda67fc))
- **aes:** use timingSafeEqual for HMAC auth tag verification ([757bef5](https://github.com/lindorm-io/monorepo/commit/757bef5657a6d1366c222c9205a8f4cfe563e77d))
- **lint:** add missing eslint-config-prettier and fix prettier formatting ([6899e39](https://github.com/lindorm-io/monorepo/commit/6899e39ad7700e373173b0a61b429b5536c13934))
- **lint:** resolve eslint warnings and errors ([210ef3c](https://github.com/lindorm-io/monorepo/commit/210ef3c91c82521c4cec57bc2256324ba9c3f45a))

### Features

- **aes:** accept optional AAD parameter for authenticated encryption ([011b67f](https://github.com/lindorm-io/monorepo/commit/011b67fb8ba18a361e2c31fd0e78298a89f89cd2))
- **aes:** add prepareEncryption() for two-step JWE-compliant encryption ([56b3c54](https://github.com/lindorm-io/monorepo/commit/56b3c5435722b2b94f05d6483c7651ccdd5ea9dd))
- **aes:** rewrite formats with unified model and always-on AAD ([bc1da71](https://github.com/lindorm-io/monorepo/commit/bc1da719d5ee5ee151d9220e6e738a9431e036b6))

## [0.5.5](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.5.4...@lindorm/aes@0.5.5) (2025-09-18)

**Note:** Version bump only for package @lindorm/aes

## [0.5.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.5.3...@lindorm/aes@0.5.4) (2025-07-19)

**Note:** Version bump only for package @lindorm/aes

## [0.5.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.5.2...@lindorm/aes@0.5.3) (2025-07-12)

**Note:** Version bump only for package @lindorm/aes

## [0.5.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.5.1...@lindorm/aes@0.5.2) (2025-07-10)

**Note:** Version bump only for package @lindorm/aes

## [0.5.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.5.0...@lindorm/aes@0.5.1) (2025-07-02)

### Bug Fixes

- amend bug in aes utility ([7437e8e](https://github.com/lindorm-io/monorepo/commit/7437e8e0f047bb0995b8a8c0e6929c9cc368d592))

# [0.5.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.4.2...@lindorm/aes@0.5.0) (2025-06-17)

### Bug Fixes

- align with kryptos changes ([3f934a4](https://github.com/lindorm-io/monorepo/commit/3f934a4ec55eee3d4ebc6f0be55886d8f095af8b))
- align with kryptos changes ([206eb38](https://github.com/lindorm-io/monorepo/commit/206eb38ae2a03b14973e706035c87a953cc753af))
- improve and expose aes parsing ([ec6f271](https://github.com/lindorm-io/monorepo/commit/ec6f27179ec3d67146a50257cbff98fe253c3380))
- improve types ([f6ce002](https://github.com/lindorm-io/monorepo/commit/f6ce002e8555c54ba4f12bd67222457fa2bcf90a))
- update try catch ([7ebebe8](https://github.com/lindorm-io/monorepo/commit/7ebebe81f40851b0d1fcb05e6e6cc60b1c754a91))

### Features

- add content type to aes data ([dfb3285](https://github.com/lindorm-io/monorepo/commit/dfb3285ddf20bc77cf8f3d2531e26032853b98a9))

## [0.4.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.4.1...@lindorm/aes@0.4.2) (2025-01-28)

**Note:** Version bump only for package @lindorm/aes

## [0.4.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.4.0...@lindorm/aes@0.4.1) (2024-10-12)

**Note:** Version bump only for package @lindorm/aes

# [0.4.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.3.3...@lindorm/aes@0.4.0) (2024-10-09)

### Bug Fixes

- move content to end of encoded array so that it can be any size ([b053924](https://github.com/lindorm-io/monorepo/commit/b05392484342976f519b32f943aac41271761df4))

### Features

- add automatic b64 encoding ([f3ac64e](https://github.com/lindorm-io/monorepo/commit/f3ac64e7922528b1afe0f0acbc52b62aa7003d2d))
- rename modes and add encoded ([b8c9d4c](https://github.com/lindorm-io/monorepo/commit/b8c9d4c26a069444fa7bff5a809308cecff971ef))

## [0.3.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.3.2...@lindorm/aes@0.3.3) (2024-09-25)

**Note:** Version bump only for package @lindorm/aes

## [0.3.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.3.1...@lindorm/aes@0.3.2) (2024-09-23)

**Note:** Version bump only for package @lindorm/aes

## [0.3.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.3.0...@lindorm/aes@0.3.1) (2024-09-20)

**Note:** Version bump only for package @lindorm/aes

# [0.3.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.2.0...@lindorm/aes@0.3.0) (2024-05-20)

### Features

- add gcm keywrap ([8eefa5d](https://github.com/lindorm-io/monorepo/commit/8eefa5dd2914faba842c0a050a9317d2b6f5b197))

# [0.2.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.1.3...@lindorm/aes@0.2.0) (2024-05-19)

### Bug Fixes

- align curves to kryptos ([b9288a5](https://github.com/lindorm-io/monorepo/commit/b9288a54b6dbb520328aff77cd3c8d2818183ac5))
- align with kryptos changes ([344c4e2](https://github.com/lindorm-io/monorepo/commit/344c4e2fad07e66c91f7e0820bfc929c1f8ffcab))
- improve kryptos generate method ([9e7098d](https://github.com/lindorm-io/monorepo/commit/9e7098d4b219b11140e28e554ffd573204772249))
- remove private key encryption ([be54916](https://github.com/lindorm-io/monorepo/commit/be54916a20de667e96826d6be0eb8d0fda67176e))
- remove unnecessary code ([e44a056](https://github.com/lindorm-io/monorepo/commit/e44a0565e577fc23a827c9283839684c1e40d287))
- rename interfaces ([3b1f457](https://github.com/lindorm-io/monorepo/commit/3b1f45736f88b8c2d4481cbeca6da87bf8443bde))
- simplify interfaces with kryptos metadata ([c4075d2](https://github.com/lindorm-io/monorepo/commit/c4075d2e133c2fe0a1fafa548da68db34b3407c6))
- use pbkdf2 key derivation for oct ([d068947](https://github.com/lindorm-io/monorepo/commit/d068947f70712fb71f57d5ec6947062219200155))

### Features

- add okp encryption and clean up ec encryption ([4d3cbab](https://github.com/lindorm-io/monorepo/commit/4d3cbabe1968ab7f8a9ecc8e226ce91403342f0f))
- implement missing encryption types ([c94b538](https://github.com/lindorm-io/monorepo/commit/c94b53823fcb7a24823b25535b83799f2bbdd250))
- refine and improve oct encryption ([99db5a2](https://github.com/lindorm-io/monorepo/commit/99db5a290b7a081ab80c3811bcc04021e1ac9b4e))
- use pbkdf with short oct keys ([d1d8e5e](https://github.com/lindorm-io/monorepo/commit/d1d8e5ea6dcac24b1b1402e841777a0affefcfff))

## [0.1.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.1.2...@lindorm/aes@0.1.3) (2024-05-12)

**Note:** Version bump only for package @lindorm/aes

## [0.1.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.1.1...@lindorm/aes@0.1.2) (2024-05-11)

**Note:** Version bump only for package @lindorm/aes

## [0.1.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/aes@0.1.0...@lindorm/aes@0.1.1) (2024-05-11)

### Bug Fixes

- amend wrong export path and rename ([87e6dd1](https://github.com/lindorm-io/monorepo/commit/87e6dd12057fe35c1c0b26a327a098015f041b44))

# 0.1.0 (2024-05-11)

### Features

- implement aes package ([4267f1f](https://github.com/lindorm-io/monorepo/commit/4267f1f2b368bcc42181f274872793897347e539))
