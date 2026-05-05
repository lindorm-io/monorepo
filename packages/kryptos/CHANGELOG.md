# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.8.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.8.0...@lindorm/kryptos@0.8.1) (2026-05-05)

### Bug Fixes

- **packages:** declare files: ["dist"] for every publishable package ([6fe2ac8](https://github.com/lindorm-io/monorepo/commit/6fe2ac818d0deba7e68f799b7f856c7ebf419832))

# [0.8.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.7.0...@lindorm/kryptos@0.8.0) (2026-05-02)

### Features

- migrate 20 packages from jest to vitest ([d8bfda8](https://github.com/lindorm-io/monorepo/commit/d8bfda8854dc1cb9537ba0b3e47ec4e4c7bded08))

# [0.7.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.6.0...@lindorm/kryptos@0.7.0) (2026-04-19)

### Features

- **kryptos:** add AKP key type with ML-DSA-44/65/87 signatures ([e18cab7](https://github.com/lindorm-io/monorepo/commit/e18cab7c1cb5d8e147cfe1eaeafd82a083fb1559))
- **kryptos:** default ECDH-ES key-wrap variants to OKP X-curves ([ad8833a](https://github.com/lindorm-io/monorepo/commit/ad8833a276ad9a25bc5df53a8175065919a2b2cb))
- **kryptos:** enable X.509 certificates for AKP (ML-DSA) keys ([7ae5fd8](https://github.com/lindorm-io/monorepo/commit/7ae5fd8bb5c58b4b29fc8fcc0fe988f93bf7f4f6))
- **kryptos:** expose KryptosKit.getTypeForAlgorithm ([68de7a4](https://github.com/lindorm-io/monorepo/commit/68de7a40e5cb0258971e449a9bc867c21fdd8e6c))

# [0.6.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.5.3...@lindorm/kryptos@0.6.0) (2026-04-15)

### Bug Fixes

- **kryptos:** add thumbprint to mock kryptos ([5ecdd5c](https://github.com/lindorm-io/monorepo/commit/5ecdd5c9970f486e51dae5304cc18425f4f74099))
- **kryptos:** decode SAN IP bytes to human-readable strings per RFC 5952 ([e03b843](https://github.com/lindorm-io/monorepo/commit/e03b8436272f23a89bbeff1298e356f8a482c132))
- **kryptos:** enforce byte-equal sigAlg between outer and inner TBS per RFC 5280 §4.1.1.2 ([3622e6d](https://github.com/lindorm-io/monorepo/commit/3622e6d66359b83fde9811627d2cc0e0f4e9e71c))
- **kryptos:** reject non-URL issuer in SAN derivation fallback ([595f3de](https://github.com/lindorm-io/monorepo/commit/595f3de061317524216352ea3d108a4e48185397))
- **kryptos:** reject pathLengthConstraint > 255 in basicConstraintsExt ([0eb05f6](https://github.com/lindorm-io/monorepo/commit/0eb05f6a45e6a9579d88640adfa84600be7d80ea))
- **kryptos:** reject zero-duration certificates in generateX509Certificate ([a638c25](https://github.com/lindorm-io/monorepo/commit/a638c254a39319d010ece7531d341b1a7e0077ed))
- **kryptos:** support RSA public keys in x509PublicKeyMatches ([9ab6e8f](https://github.com/lindorm-io/monorepo/commit/9ab6e8ffd3e84621e2041a6f6ffa0faf78e97e4e)), closes [PKCS#1](https://github.com/PKCS/issues/1)
- **kryptos:** use @lindorm/date for validity defaults and inherit CA window for ca-signed children ([ceeec3d](https://github.com/lindorm-io/monorepo/commit/ceeec3d2851705b06a2d6020f9e981753183a684))
- **kryptos:** widen createMockKryptos overrides to Partial<MockKryptos> ([c1ef0c0](https://github.com/lindorm-io/monorepo/commit/c1ef0c09f39707089d2dd016393674d37dc176ba))

### Features

- **kryptos:** add certificateChain/certificateThumbprint and drop x5t/updatedAt ([a9f2836](https://github.com/lindorm-io/monorepo/commit/a9f283672d3cb612a8bee568594b5bca03ac0713)), closes [x5t#S256](https://github.com/x5t/issues/S256) [x5t#S256](https://github.com/x5t/issues/S256)
- **kryptos:** add minimal ASN.1 DER encoder + decoder primitives ([c089fcd](https://github.com/lindorm-io/monorepo/commit/c089fcd5f5ac61e5f5800f1eb327d5bae87fcc12))
- **kryptos:** add RFC 7638 JWK thumbprint getter ([ad3d347](https://github.com/lindorm-io/monorepo/commit/ad3d347df6b9380144520034c6ae9e31e49f9dba))
- **kryptos:** add self-signed and ca-signed cert generation to KryptosKit.generate ([ed6eaf1](https://github.com/lindorm-io/monorepo/commit/ed6eaf1d45305d40f012e53c0286ed4956388943))
- **kryptos:** add X.509 certificate builder using DIY ASN.1 encoder ([4ced43a](https://github.com/lindorm-io/monorepo/commit/4ced43a823869fe5db282c99db089424340abf21))
- **kryptos:** add X.509 certificate chain support with pragmatic chain validation ([2f56021](https://github.com/lindorm-io/monorepo/commit/2f560212bc0a9d23e7aae3ed0666e1bb6def5316))
- **kryptos:** add X.509 parser and replace Node X509Certificate usage internally ([c28da3e](https://github.com/lindorm-io/monorepo/commit/c28da3e66e3a65079884d77c224fccb550bd4ede))
- **kryptos:** round-trip certificateChain through toJSON/toDB/fromJWK ([966d8d7](https://github.com/lindorm-io/monorepo/commit/966d8d73355fe4122dfaa85db9892980306ff062))
- **kryptos:** support dns/email/ip subject alternative names in cert generation ([1956d21](https://github.com/lindorm-io/monorepo/commit/1956d215d714e5cbfc40be01682c8f2032f99c07))

## [0.5.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.5.2...@lindorm/kryptos@0.5.3) (2026-04-01)

**Note:** Version bump only for package @lindorm/kryptos

## [0.5.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.5.1...@lindorm/kryptos@0.5.2) (2026-03-13)

**Note:** Version bump only for package @lindorm/kryptos

## [0.5.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.5.0...@lindorm/kryptos@0.5.1) (2026-03-13)

**Note:** Version bump only for package @lindorm/kryptos

# [0.5.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.4.5...@lindorm/kryptos@0.5.0) (2026-02-17)

### Bug Fixes

- **aes:** make CBC HMAC auth tag compliant with RFC 7518 ([7877022](https://github.com/lindorm-io/monorepo/commit/7877022bebdf902ff13996b1032a991356f3760c))
- **kryptos:** rewrite RSA modulus detection and add encryption to autoGenerateConfig ([b57a86a](https://github.com/lindorm-io/monorepo/commit/b57a86a79c7ce885c1142d1801bdd9484f17fb97))
- **kryptos:** update CBC-HS key size test expectations ([b3614f9](https://github.com/lindorm-io/monorepo/commit/b3614f91a70e01a36132dc919d10dc8194ec81ff))
- **lint:** resolve eslint warnings and errors ([210ef3c](https://github.com/lindorm-io/monorepo/commit/210ef3c91c82521c4cec57bc2256324ba9c3f45a))
- resolve bugs and weaknesses in kryptos ([a078855](https://github.com/lindorm-io/monorepo/commit/a078855cdf367c84c0187416f8ed2b9d626a21a4))

### Features

- **kryptos:** add static mock key fixtures for all key types ([f81168b](https://github.com/lindorm-io/monorepo/commit/f81168bf975b10b472787e264c569c47c276f1c0))

## [0.4.5](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.4.4...@lindorm/kryptos@0.4.5) (2025-09-18)

**Note:** Version bump only for package @lindorm/kryptos

## [0.4.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.4.3...@lindorm/kryptos@0.4.4) (2025-07-19)

### Bug Fixes

- remove unnecessary enums ([d0364d9](https://github.com/lindorm-io/monorepo/commit/d0364d97ad0dc621a1020d4ddba8d3a87959838d))

## [0.4.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.4.2...@lindorm/kryptos@0.4.3) (2025-07-12)

**Note:** Version bump only for package @lindorm/kryptos

## [0.4.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.4.1...@lindorm/kryptos@0.4.2) (2025-07-10)

**Note:** Version bump only for package @lindorm/kryptos

## [0.4.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.4.0...@lindorm/kryptos@0.4.1) (2025-07-02)

**Note:** Version bump only for package @lindorm/kryptos

# [0.4.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.3.7...@lindorm/kryptos@0.4.0) (2025-06-17)

### Bug Fixes

- automatically generate encryption ([2084cc7](https://github.com/lindorm-io/monorepo/commit/2084cc75968b152a40355e8c2dfa807a78aaf157))
- export env string as b64u encoded jwk ([06185f6](https://github.com/lindorm-io/monorepo/commit/06185f6b525e61badf6af3ad5272159b0caa8541))
- export more data in env string ([ea92ef5](https://github.com/lindorm-io/monorepo/commit/ea92ef514f9efd9ae9e81018799d9c60ca30662b))
- improve types ([f6ce002](https://github.com/lindorm-io/monorepo/commit/f6ce002e8555c54ba4f12bd67222457fa2bcf90a))
- parse encryption in std options ([ffe9a8f](https://github.com/lindorm-io/monorepo/commit/ffe9a8fc99382b459d2aed25bd567c3a98e4c9c5))
- update mock ([6dc1a8a](https://github.com/lindorm-io/monorepo/commit/6dc1a8abfa208ae316716c6eec4df3e45935735d))
- update typing and make public key optional ([ebe9311](https://github.com/lindorm-io/monorepo/commit/ebe9311c395da84b69d95701b087aaecb8057574))
- use commander for kryptos cli ([20168d8](https://github.com/lindorm-io/monorepo/commit/20168d89f9ced49b744dc6a0fb4cc72c6f6e3a58))
- use null and typed purpose ([b318d83](https://github.com/lindorm-io/monorepo/commit/b318d83b572eb52c7bfdf1e086f7e559da898661))

### Features

- add cli for generating kryptos env keys ([073ca5f](https://github.com/lindorm-io/monorepo/commit/073ca5fa867d82af2d47f497aad785eaf964aeb8))
- add env string to kryptos kit ([174970d](https://github.com/lindorm-io/monorepo/commit/174970d99b77642f4e69ac01d038b90c746f0890))
- add kryptos db consideration ([7c35ac7](https://github.com/lindorm-io/monorepo/commit/7c35ac74d4404c88ffd69b70d08ed4b14b35d246))
- introduce kryptos kit ([92b2cbb](https://github.com/lindorm-io/monorepo/commit/92b2cbb231b382c4f52c09ff47b3de2e68e8ca8a))
- require id for valid kryptos ([a49cf11](https://github.com/lindorm-io/monorepo/commit/a49cf1106d679ca28fb3af5334e80d78e71e8ce0))

## [0.3.7](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.3.6...@lindorm/kryptos@0.3.7) (2025-01-28)

**Note:** Version bump only for package @lindorm/kryptos

## [0.3.6](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.3.5...@lindorm/kryptos@0.3.6) (2024-10-12)

**Note:** Version bump only for package @lindorm/kryptos

## [0.3.5](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.3.4...@lindorm/kryptos@0.3.5) (2024-10-09)

### Bug Fixes

- add mock ([e154c05](https://github.com/lindorm-io/monorepo/commit/e154c056bdeab56f2af68af2697ebc390ebc5bb9))
- expand static generators ([3fe2a59](https://github.com/lindorm-io/monorepo/commit/3fe2a59d2a13b8ecbe10102e4cc1ff87490ff8f0))

## [0.3.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.3.3...@lindorm/kryptos@0.3.4) (2024-09-25)

**Note:** Version bump only for package @lindorm/kryptos

## [0.3.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.3.2...@lindorm/kryptos@0.3.3) (2024-09-23)

**Note:** Version bump only for package @lindorm/kryptos

## [0.3.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.3.1...@lindorm/kryptos@0.3.2) (2024-09-20)

### Bug Fixes

- amend bug in modulus size calculation ([9d5d84c](https://github.com/lindorm-io/monorepo/commit/9d5d84c2790f2a941c963fd6bdeb58870d01c6c1))
- import from interfaces ([153a89a](https://github.com/lindorm-io/monorepo/commit/153a89ae3ca0ff9731fe1b69108b6c0649d497f6))
- improve kryptos generation ([aa7122c](https://github.com/lindorm-io/monorepo/commit/aa7122c2c1a0e29afc3e5a48d2b8a735a4a9b09b))

## [0.3.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.3.0...@lindorm/kryptos@0.3.1) (2024-05-20)

### Bug Fixes

- add encryption algorithms ([ce0698b](https://github.com/lindorm-io/monorepo/commit/ce0698b73c596ec1f414c9ad5c53375a639c3429))

# [0.3.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.2.1...@lindorm/kryptos@0.3.0) (2024-05-19)

### Bug Fixes

- add key ops calculation ([3d69270](https://github.com/lindorm-io/monorepo/commit/3d692701834207a322929f57f2b5884ced9ebdd1))
- add missing encryption types ([ae3e0cb](https://github.com/lindorm-io/monorepo/commit/ae3e0cba7cb0cd9efb20859f385a523f2824903d))
- amend key metadata getters ([4a9b1c8](https://github.com/lindorm-io/monorepo/commit/4a9b1c8df2d3ad897056d9cdf2cf428d733a2c13))
- improve kryptos generate method ([9e7098d](https://github.com/lindorm-io/monorepo/commit/9e7098d4b219b11140e28e554ffd573204772249))
- refine curves ([8906582](https://github.com/lindorm-io/monorepo/commit/8906582ab2fd241928c74150b07650efb04981ee))
- remove unused raw export ([9e35023](https://github.com/lindorm-io/monorepo/commit/9e350233c424ddf70705a1187f1412454406ad21))
- remove unused rsa algorithm ([04ceb79](https://github.com/lindorm-io/monorepo/commit/04ceb79842dafbb8e00dfb8c32c3c34dd9e3d118))
- rename interfaces ([3b1f457](https://github.com/lindorm-io/monorepo/commit/3b1f45736f88b8c2d4481cbeca6da87bf8443bde))
- validate kryptos options on import ([7fd719c](https://github.com/lindorm-io/monorepo/commit/7fd719c0d76072f62a55bc444c8b33d70163a8c0))

### Features

- add jws algorithm type ([4d3465b](https://github.com/lindorm-io/monorepo/commit/4d3465b91b6d9c65fcee6b85bc5714014a2da01c))
- add pbes2 oct keys ([0319e1c](https://github.com/lindorm-io/monorepo/commit/0319e1cac3f989d8463e2d0438e126e5a8fcf743))
- major overhaul of kryptos functionality and typing ([a1d7272](https://github.com/lindorm-io/monorepo/commit/a1d7272e34ec0285c03857c9a5a2149ce83b75ce))

## [0.2.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.2.0...@lindorm/kryptos@0.2.1) (2024-05-12)

### Bug Fixes

- resolve bugs in kryptos ([73a98de](https://github.com/lindorm-io/monorepo/commit/73a98de215e7432acef1c9e60d0cd7b0631ae711))

# [0.2.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.1.0...@lindorm/kryptos@0.2.0) (2024-05-11)

### Bug Fixes

- amend type errors ([0079b70](https://github.com/lindorm-io/monorepo/commit/0079b708dc95137a0703c15595e78f25cc2ec37f))

### Features

- implement kryptos error ([43a3f4f](https://github.com/lindorm-io/monorepo/commit/43a3f4f52eeda8ef3ec15c7386e8a6a8f52ef282))
- improve generation and add type checks ([0701c43](https://github.com/lindorm-io/monorepo/commit/0701c43ba67f06f2b2a6284c362a0d8ec3363834))

# 0.1.0 (2024-05-10)

### Features

- initialise kryptos package ([709c0b8](https://github.com/lindorm-io/monorepo/commit/709c0b84b3207a3d61aaac4a3ca0ebd8ce80e729))
