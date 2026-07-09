# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.11.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.4.5...@lindorm/kryptos@0.11.0) (2026-07-09)

### Bug Fixes

- **aes:** make CBC HMAC auth tag compliant with RFC 7518 ([04eafc4](https://github.com/lindorm-io/monorepo/commit/04eafc491347c24b20fb295361a88902823e993a))
- **eslint:** forbid redundant public via explicit-member-accessibility no-public ([e759b1f](https://github.com/lindorm-io/monorepo/commit/e759b1f1c552b50d150aecca51488eac64856d91))
- **kryptos:** add thumbprint to mock kryptos ([0d7b296](https://github.com/lindorm-io/monorepo/commit/0d7b2968e8379f1156365e75017d7b54c82a7d4c))
- **kryptos:** decode SAN IP bytes to human-readable strings per RFC 5952 ([700834b](https://github.com/lindorm-io/monorepo/commit/700834b3d862612156cf1e00052c500cbbf7f960))
- **kryptos:** enforce byte-equal sigAlg between outer and inner TBS per RFC 5280 §4.1.1.2 ([850485f](https://github.com/lindorm-io/monorepo/commit/850485f210a163c94c662281ce4a86a9c9a6972b))
- **kryptos:** identify Kryptos by global-registry brand, not instanceof ([bbce0ae](https://github.com/lindorm-io/monorepo/commit/bbce0ae412b4feee3ce36e3074583f0c2de41dc9))
- **kryptos:** reject non-URL issuer in SAN derivation fallback ([5dfc8cc](https://github.com/lindorm-io/monorepo/commit/5dfc8cc2e8ebf0068915786a5ff3f2a41ba58bbb))
- **kryptos:** reject pathLengthConstraint > 255 in basicConstraintsExt ([0bfd315](https://github.com/lindorm-io/monorepo/commit/0bfd315e319957ceedaf38e45016920c2af5d139))
- **kryptos:** reject zero-duration certificates in generateX509Certificate ([572bd15](https://github.com/lindorm-io/monorepo/commit/572bd154c21d06887345dc5d9e16b6576524596e))
- **kryptos:** rewrite RSA modulus detection and add encryption to autoGenerateConfig ([e94ba6b](https://github.com/lindorm-io/monorepo/commit/e94ba6be6a3f29bbf62a938eb56143af5aa87e0d))
- **kryptos:** support RSA public keys in x509PublicKeyMatches ([4134b62](https://github.com/lindorm-io/monorepo/commit/4134b620ee257be2f61e59a7e56b8ef87b1081df)), closes [PKCS#1](https://github.com/PKCS/issues/1)
- **kryptos:** update CBC-HS key size test expectations ([2380c65](https://github.com/lindorm-io/monorepo/commit/2380c6548811a225656e9c60b2c9e0ec96d0c793))
- **kryptos:** use @lindorm/date for validity defaults and inherit CA window for ca-signed children ([c123718](https://github.com/lindorm-io/monorepo/commit/c123718312ef4db8f9edeae2479c4859422a3e5c))
- **kryptos:** widen createMockKryptos overrides to Partial<MockKryptos> ([ceb8d62](https://github.com/lindorm-io/monorepo/commit/ceb8d62642a35be941a8e69b3d2dd5ac82adbaef))
- **lint:** resolve eslint warnings and errors ([2727420](https://github.com/lindorm-io/monorepo/commit/2727420afd268e6cb8271cd235144fb636a02715))
- **packages:** declare files: ["dist"] for every publishable package ([b8d29fc](https://github.com/lindorm-io/monorepo/commit/b8d29fc24996a02636ddecc11c5d25da4930ef11))
- resolve bugs and weaknesses in kryptos ([a078855](https://github.com/lindorm-io/monorepo/commit/a078855cdf367c84c0187416f8ed2b9d626a21a4))

### Features

- **kryptos:** add AKP key type with ML-DSA-44/65/87 signatures ([c085ea0](https://github.com/lindorm-io/monorepo/commit/c085ea0001e189cccb797b5faedbaa77b44d1fdd))
- **kryptos:** add certificateChain/certificateThumbprint and drop x5t/updatedAt ([0b3df2f](https://github.com/lindorm-io/monorepo/commit/0b3df2ff6f8458c672c2b25cc2e01b53dc61ed92)), closes [x5t#S256](https://github.com/x5t/issues/S256) [x5t#S256](https://github.com/x5t/issues/S256)
- **kryptos:** add minimal ASN.1 DER encoder + decoder primitives ([9b50604](https://github.com/lindorm-io/monorepo/commit/9b50604108faa067cffc3f3cd7eecf2ec01bfbdb))
- **kryptos:** add RFC 7638 JWK thumbprint getter ([a8846b9](https://github.com/lindorm-io/monorepo/commit/a8846b9594557ef5d40034c15a85f0fc6d44c128))
- **kryptos:** add self-signed and ca-signed cert generation to KryptosKit.generate ([f190f8d](https://github.com/lindorm-io/monorepo/commit/f190f8d1787519cd64ca2ec937df374227b84ffe))
- **kryptos:** add static mock key fixtures for all key types ([a53769e](https://github.com/lindorm-io/monorepo/commit/a53769e1278ab30e64db36454e63941da3f814c2))
- **kryptos:** add titles and details to thrown errors ([7a804e0](https://github.com/lindorm-io/monorepo/commit/7a804e05b4f1f0ac093b5ab9d94e917fe97c9742))
- **kryptos:** add X.509 certificate builder using DIY ASN.1 encoder ([de3bec6](https://github.com/lindorm-io/monorepo/commit/de3bec600b2da1c2e7d96432521faab1cead7f79))
- **kryptos:** add X.509 certificate chain support with pragmatic chain validation ([e3ff720](https://github.com/lindorm-io/monorepo/commit/e3ff720ca307e2ada36c072ec8fca1535a705ec5))
- **kryptos:** add X.509 parser and replace Node X509Certificate usage internally ([f6f5577](https://github.com/lindorm-io/monorepo/commit/f6f5577e4dc88fbdf6db6c486c80f6bebdbae326))
- **kryptos:** default ECDH-ES key-wrap variants to OKP X-curves ([be79e67](https://github.com/lindorm-io/monorepo/commit/be79e673810a4a4671b98d820a9b88c886b8fd06))
- **kryptos:** enable X.509 certificates for AKP (ML-DSA) keys ([b9e0221](https://github.com/lindorm-io/monorepo/commit/b9e022164e50c5cd05f3f36d7d6efc3ee36c7a42))
- **kryptos:** enforce RFC 9964 AKP JWK seed and public-key sizes ([7939e42](https://github.com/lindorm-io/monorepo/commit/7939e422c24111e1842251bd1a9d2ed2fe5785cd))
- **kryptos:** expose KryptosKit.getTypeForAlgorithm ([00bb7b0](https://github.com/lindorm-io/monorepo/commit/00bb7b0ee81e80debc0582e3fe7804104f0bc732))
- **kryptos:** finish enriching thrown errors with codes ([da5d486](https://github.com/lindorm-io/monorepo/commit/da5d486f17996fc733eb6c5069ab1bfabfd9f279))
- **kryptos:** generate key ids as namespaced lindorm ids ([a98172f](https://github.com/lindorm-io/monorepo/commit/a98172f6a69f29e6803edfea6aa7f2bf34de5d6c))
- **kryptos:** generate X.509 certs from the CLI, scriptable via flags ([6658b5b](https://github.com/lindorm-io/monorepo/commit/6658b5b920f48b1f77bee0265af93e5482a6adfa))
- **kryptos:** namespace errors, begin throw enrichment ([d2a0b68](https://github.com/lindorm-io/monorepo/commit/d2a0b688ceeb688d05966ae5a97ca04e36d598f8))
- **kryptos:** round-trip certificateChain through toJSON/toDB/fromJWK ([0cf75e3](https://github.com/lindorm-io/monorepo/commit/0cf75e302791969e2e9589e99e2ca9f252bb8a61))
- **kryptos:** safe user-supplied oct secrets (validate raw + deriveFrom HKDF) ([5f3dcb1](https://github.com/lindorm-io/monorepo/commit/5f3dcb1b51e76220dd68b070cdfa9203be16c728))
- **kryptos:** size AES-CCM dir keys ([df6c635](https://github.com/lindorm-io/monorepo/commit/df6c635106d0bc4b1c96db597935fe40a9b467f4))
- **kryptos:** support dns/email/ip subject alternative names in cert generation ([4186bea](https://github.com/lindorm-io/monorepo/commit/4186bea3cc55c0d57cdd01b1c2e2ac913c2ce84b))
- migrate 20 packages from jest to vitest ([e9d3c7a](https://github.com/lindorm-io/monorepo/commit/e9d3c7ad717b15fee223451242eb8d7bb71edf4a))

## [0.10.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.10.0...@lindorm/kryptos@0.10.1) (2026-07-02)

### Bug Fixes

- **eslint:** forbid redundant public via explicit-member-accessibility no-public ([0ca0e95](https://github.com/lindorm-io/monorepo/commit/0ca0e953509d6d28baabcbc5233c1a17e6e6efa0))
- **kryptos:** identify Kryptos by global-registry brand, not instanceof ([7f979a9](https://github.com/lindorm-io/monorepo/commit/7f979a95f79b526cabd02ebb7c1005c2499954ee))

# [0.10.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.9.0...@lindorm/kryptos@0.10.0) (2026-06-19)

### Features

- **kryptos:** generate key ids as namespaced lindorm ids ([d786673](https://github.com/lindorm-io/monorepo/commit/d78667325ec4d7cbdb1e4c276cd1452d99b0727a))
- **kryptos:** safe user-supplied oct secrets (validate raw + deriveFrom HKDF) ([4407804](https://github.com/lindorm-io/monorepo/commit/44078048e23d6c0f6fd5df2361c81fc6d236fd9c))

# [0.9.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.8.2...@lindorm/kryptos@0.9.0) (2026-06-15)

### Features

- **kryptos:** add titles and details to thrown errors ([cd95d51](https://github.com/lindorm-io/monorepo/commit/cd95d513e2de5cfc761c5ecc9e97ff96c1138e5f))
- **kryptos:** enforce RFC 9964 AKP JWK seed and public-key sizes ([48b6e6f](https://github.com/lindorm-io/monorepo/commit/48b6e6f1db91aadcfa724ccbfd5dcee156dec800))
- **kryptos:** finish enriching thrown errors with codes ([0f0506d](https://github.com/lindorm-io/monorepo/commit/0f0506df2085b45f3ce603c797d26c3beaee838f))
- **kryptos:** namespace errors, begin throw enrichment ([8b464ee](https://github.com/lindorm-io/monorepo/commit/8b464eeca2e61f0f6c101676c83c775eafcddd80))
- **kryptos:** size AES-CCM dir keys ([9bc2ec3](https://github.com/lindorm-io/monorepo/commit/9bc2ec34ce38a6a78f926eb15cf30944d61d0949))

## [0.8.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/kryptos@0.8.1...@lindorm/kryptos@0.8.2) (2026-06-05)

**Note:** Version bump only for package @lindorm/kryptos

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
