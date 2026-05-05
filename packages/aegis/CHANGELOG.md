# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.7.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.7.0...@lindorm/aegis@0.7.1) (2026-05-05)

### Bug Fixes

- **aegis:** extend timeout for RSA-OAEP-512 algorithm test ([b418307](https://github.com/lindorm-io/monorepo/commit/b4183075263fff656337663e8d0e0bcdb892309d))

# [0.7.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.6.0...@lindorm/aegis@0.7.0) (2026-05-02)

### Bug Fixes

- **aegis:** drop createRequire interop workaround in jwt-interop test ([492e3df](https://github.com/lindorm-io/monorepo/commit/492e3dff29971a3958b0628ce5465195f8a8cfe5))
- widen @lindorm/\* peer ranges to unbounded >= ([f192b59](https://github.com/lindorm-io/monorepo/commit/f192b59107bf1f276d296837f40fa97765d9d2ba))

### Features

- migrate 20 packages from jest to vitest ([d8bfda8](https://github.com/lindorm-io/monorepo/commit/d8bfda8854dc1cb9537ba0b3e47ec4e4c7bded08))

# [0.6.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.5.0...@lindorm/aegis@0.6.0) (2026-04-19)

### Features

- **aegis:** accept AKP algorithms in token header ([3dc40b7](https://github.com/lindorm-io/monorepo/commit/3dc40b781f436181a6453235d8f4dc7c61885e7d))
- **aegis:** route AKP kryptos keys through AkpKit for ML-DSA JWS ([a9351fc](https://github.com/lindorm-io/monorepo/commit/a9351fc94e47de240d51f2024a418111e762f046))

# [0.5.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.4.4...@lindorm/aegis@0.5.0) (2026-04-15)

### Bug Fixes

- **aegis:** accept AesContent in IAegisAes types, delegate mock to AesKit ([11b78df](https://github.com/lindorm-io/monorepo/commit/11b78df01112106280466a1824a8c47151ceee65))
- **aegis:** adopt kryptos descriptive cert fields and drop SHA-1 x5t binding ([06e4d4d](https://github.com/lindorm-io/monorepo/commit/06e4d4dd4bc2f3311370335316d1ffb27df0a317))
- **aegis:** resolve historical kryptos by id when verifying JWE/JWS ([24c81d4](https://github.com/lindorm-io/monorepo/commit/24c81d4dfa2da67eafcc6e1af432af1a75567b16))
- **aegis:** string verifier for array-valued claims uses containment ([7cc2c7e](https://github.com/lindorm-io/monorepo/commit/7cc2c7e32140a29ffddd079f956dee9e611ae03c))

### Features

- **aegis:** add act, may_act, groups, entitlements claim types ([ed80767](https://github.com/lindorm-io/monorepo/commit/ed80767a029fded720bb9af44fb3cdeb2b5c30d6))
- **aegis:** add AegisProfile claim type for ID token profile personalization ([929a9b6](https://github.com/lindorm-io/monorepo/commit/929a9b6ee7b051d50dda8aa8c6a1c3e88e23e4d5))
- **aegis:** add baseFormat to parsed token headers ([43d37a0](https://github.com/lindorm-io/monorepo/commit/43d37a02a3ae1773fb166aabd7f7957dcf30e4ac))
- **aegis:** add bindCertificate sign option and post-verify thumbprint check ([0d4e2a5](https://github.com/lindorm-io/monorepo/commit/0d4e2a5bdfbfa745b7b3e137ecf4b4a617c6d8f5)), closes [x5t#S256](https://github.com/x5t/issues/S256)
- **aegis:** add certBindingMode strict/lax for cert-binding verify ([bfd2165](https://github.com/lindorm-io/monorepo/commit/bfd2165d65a1bdb0895e503466dfc287259f7a66))
- **aegis:** add cnf claim support on sign and parse ([e7d7a28](https://github.com/lindorm-io/monorepo/commit/e7d7a28d1b82cf711c54d64aa51f2615b96c1e4d))
- **aegis:** add isParsedJwt and isParsedJws guards ([1640977](https://github.com/lindorm-io/monorepo/commit/1640977405de7bc183e98b24857ce33cc21ad0d4))
- **aegis:** add TokenType, AuthFactor, SessionHint, SubjectHint types ([fb7a15a](https://github.com/lindorm-io/monorepo/commit/fb7a15a2687ed0e1126ac94c23ed01472d0fa044))
- **aegis:** add userinfo and introspection parse utilities ([ab2e14f](https://github.com/lindorm-io/monorepo/commit/ab2e14f4ef0b40c7a70ad0fe08079a88c99c5f33))
- **aegis:** attach TokenIdentity to parsed results and add actor verify option ([7bcfdae](https://github.com/lindorm-io/monorepo/commit/7bcfdae0d4d1c83811ea8e03437fb284113f69e4))
- **aegis:** auto-stamp thumbprint on sign when kryptos has cert, add none mode ([441630f](https://github.com/lindorm-io/monorepo/commit/441630f177b4264a791da9ce9e5409b4de15958a))
- **aegis:** enforce algorithm allowlist in decodeJoseHeader ([5be80a1](https://github.com/lindorm-io/monorepo/commit/5be80a10aa7461323e1b620bed8a699f960e7089)), closes [PKCS#1](https://github.com/PKCS/issues/1)
- **aegis:** expose parseUserinfo, parseIntrospection, and validateClaims on Aegis ([a29ec9c](https://github.com/lindorm-io/monorepo/commit/a29ec9c3568631c067d0984de07769a969ca1719))
- **aegis:** reject JWE tokens with zip compression header ([644d37d](https://github.com/lindorm-io/monorepo/commit/644d37debea9a5bf0edab469ced8e2bc6467bf60))
- **aegis:** validate tokenType input in computeTypHeader ([5d95fb6](https://github.com/lindorm-io/monorepo/commit/5d95fb69ab5625cd6812b5b29be91c436f8001a0))
- **aegis:** verify DPoP proofs as part of JWT verification ([9795b7c](https://github.com/lindorm-io/monorepo/commit/9795b7c1d0b8925050fe82176515a47aeefd5957))

## [0.4.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.4.3...@lindorm/aegis@0.4.4) (2026-04-01)

**Note:** Version bump only for package @lindorm/aegis

## [0.4.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.4.2...@lindorm/aegis@0.4.3) (2026-03-29)

**Note:** Version bump only for package @lindorm/aegis

## [0.4.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.4.1...@lindorm/aegis@0.4.2) (2026-03-13)

**Note:** Version bump only for package @lindorm/aegis

## [0.4.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.4.0...@lindorm/aegis@0.4.1) (2026-03-13)

**Note:** Version bump only for package @lindorm/aegis

# [0.4.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.3.6...@lindorm/aegis@0.4.0) (2026-02-17)

### Bug Fixes

- **aegis:** align header parsing types with AES decryption record types ([8d6539d](https://github.com/lindorm-io/monorepo/commit/8d6539d41657343edce4c94c884fe592c9bb12e6))
- **aegis:** relax algorithm validation in header decoding ([fbc6edc](https://github.com/lindorm-io/monorepo/commit/fbc6edc003849963827c483ff2d995cd5b66eada))
- **aegis:** relax typ validation and fix kryptosSig algorithm bug ([cb1bb60](https://github.com/lindorm-io/monorepo/commit/cb1bb601e2004de4b0a6454dd60a35be7770f59c))
- **aegis:** remove hkdfSalt references after aes package refactor ([30c008a](https://github.com/lindorm-io/monorepo/commit/30c008a99a364928ed83fbb7ee6b496691646f80))
- **aegis:** remove jwksUri from COSE sign/encrypt headers ([2c47fd4](https://github.com/lindorm-io/monorepo/commit/2c47fd43297db43e8f6b98df4b25ee93e93415af))
- **aegis:** restructure CweKit header layout per RFC 9052 ([43f2616](https://github.com/lindorm-io/monorepo/commit/43f2616b34de529e968f75714a2222ed4d02a509))
- **aegis:** rFC 7515 crit compliance and base64url header encoding ([f3fa30b](https://github.com/lindorm-io/monorepo/commit/f3fa30b89f10518efa86ad69577e1d1c35faf030))
- **aegis:** use Map-based COSE encoding for RFC 9052 integer labels ([e2eb229](https://github.com/lindorm-io/monorepo/commit/e2eb229b053c9c91ba8b4b43d8ad9e1731ec53b4))
- **lint:** add missing eslint-config-prettier and fix prettier formatting ([6899e39](https://github.com/lindorm-io/monorepo/commit/6899e39ad7700e373173b0a61b429b5536c13934))

### Features

- **aegis:** add COSE target mode for internal/external encoding ([0be6874](https://github.com/lindorm-io/monorepo/commit/0be687457cea0266cefdff8fc504b05175aa8bbf))
- **aegis:** integrate prepareEncryption for JWE AAD support ([0b5a607](https://github.com/lindorm-io/monorepo/commit/0b5a60749b935068a02c6ae9fa1a637e0bfa8764))
- **aegis:** narrow AmphoraQuery type by operation ([e908b40](https://github.com/lindorm-io/monorepo/commit/e908b405f5269aaa864f2da5b19879f9d999e485))
- **aegis:** support custom COSE claim labels (>= 900) in CWT payloads ([a5f30c0](https://github.com/lindorm-io/monorepo/commit/a5f30c09d6ca21dc029a6d2a601ff3cf35b8dff4))

## [0.3.6](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.3.5...@lindorm/aegis@0.3.6) (2025-09-18)

**Note:** Version bump only for package @lindorm/aegis

## [0.3.5](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.3.4...@lindorm/aegis@0.3.5) (2025-07-19)

**Note:** Version bump only for package @lindorm/aegis

## [0.3.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.3.3...@lindorm/aegis@0.3.4) (2025-07-12)

**Note:** Version bump only for package @lindorm/aegis

## [0.3.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.3.2...@lindorm/aegis@0.3.3) (2025-07-10)

**Note:** Version bump only for package @lindorm/aegis

## [0.3.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.3.1...@lindorm/aegis@0.3.2) (2025-07-02)

**Note:** Version bump only for package @lindorm/aegis

## [0.3.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.3.0...@lindorm/aegis@0.3.1) (2025-06-24)

**Note:** Version bump only for package @lindorm/aegis

# [0.3.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.2.6...@lindorm/aegis@0.3.0) (2025-06-17)

### Bug Fixes

- add missing header options to sign and encrypt ([d0007e7](https://github.com/lindorm-io/monorepo/commit/d0007e70c0afcf5945b223b27e7b8c02c07b3109))
- add missing jwt options for verify ([c5b9439](https://github.com/lindorm-io/monorepo/commit/c5b9439b41a7de541e966c350102b7cffde389b5))
- add optional key filter for aegis ([49a6d75](https://github.com/lindorm-io/monorepo/commit/49a6d75a89f435c40389fbee00840c011e369b00))
- align with kryptos changes ([206eb38](https://github.com/lindorm-io/monorepo/commit/206eb38ae2a03b14973e706035c87a953cc753af))
- amend bugs ([a68a77a](https://github.com/lindorm-io/monorepo/commit/a68a77a811ddfe33a0b487cd84cda6a18d3054b6))
- amend errors in mock ([4e80b28](https://github.com/lindorm-io/monorepo/commit/4e80b28e2bd35ae7ae43da9d3b480bae935aef08))
- handle correct typing ([630fa33](https://github.com/lindorm-io/monorepo/commit/630fa332c16557fa5f16c3cc673af563d5ea4e24))
- improve content type method ([d12f1fd](https://github.com/lindorm-io/monorepo/commit/d12f1fd4484c5e6b1becbdd72feed010d2c5cd98))
- merge domain with issuer for ease of understanding ([9123cc2](https://github.com/lindorm-io/monorepo/commit/9123cc2ede63962a5c226a9bed0d0541001384d9))
- minor improvements ([0f7db68](https://github.com/lindorm-io/monorepo/commit/0f7db68cddefce258434258ea9f6c0d5f5ba4fc4))
- rename kits ([da103bf](https://github.com/lindorm-io/monorepo/commit/da103bf21fc25f3477dd9b70a851e4bca5758283))
- update types and fallback to amphora issuer ([8130b45](https://github.com/lindorm-io/monorepo/commit/8130b45bc7a1c2080e029e6e2efc8c58a65f1d7e))

### Features

- add aegis aes and improve key methods ([ac1800e](https://github.com/lindorm-io/monorepo/commit/ac1800e65f1e9fc82814bb84793678f8c3fd1f8d))
- add decode and verify to aegis ([bd6c9c3](https://github.com/lindorm-io/monorepo/commit/bd6c9c3b041eb0ed398d01f8d52b44e74cbad429))
- add signature kit ([ca99771](https://github.com/lindorm-io/monorepo/commit/ca99771955b69a41a1add2cbad6a9512783f54ab))
- add static token parsing to aegis ([2b8803c](https://github.com/lindorm-io/monorepo/commit/2b8803c189ce2bc97fe49c977e6fbb58cace13f7))
- implement cose-encrypt kit ([5f94faf](https://github.com/lindorm-io/monorepo/commit/5f94fafc28ab737b02cb3e7566da0d5c827d8c1a))
- implement cose-sign kit ([fd92fa3](https://github.com/lindorm-io/monorepo/commit/fd92fa346401de76967f5d3c0cc5fd6531e4b4bd))
- introduce cwt to aegis ([40a7efa](https://github.com/lindorm-io/monorepo/commit/40a7efa1ce2907c0e4671d20cd9d9fb457a346db))

## [0.2.6](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.2.5...@lindorm/aegis@0.2.6) (2025-01-28)

**Note:** Version bump only for package @lindorm/aegis

## [0.2.5](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.2.4...@lindorm/aegis@0.2.5) (2024-10-12)

**Note:** Version bump only for package @lindorm/aegis

## [0.2.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.2.3...@lindorm/aegis@0.2.4) (2024-10-09)

### Bug Fixes

- align with aes changes ([f49b8c0](https://github.com/lindorm-io/monorepo/commit/f49b8c01cb8893e624da046832965bf64889117b))

## [0.2.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.2.2...@lindorm/aegis@0.2.3) (2024-09-25)

**Note:** Version bump only for package @lindorm/aegis

## [0.2.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.2.1...@lindorm/aegis@0.2.2) (2024-09-23)

**Note:** Version bump only for package @lindorm/aegis

## [0.2.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.2.0...@lindorm/aegis@0.2.1) (2024-09-20)

### Bug Fixes

- make issuer optional ([6e85927](https://github.com/lindorm-io/monorepo/commit/6e859272370e59dc334aca702fa37e1765f542ab))
- return token on verify ([8bad0e0](https://github.com/lindorm-io/monorepo/commit/8bad0e02cb7979c9462387fcb62026e9e895643c))

# [0.2.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.1.1...@lindorm/aegis@0.2.0) (2024-05-20)

### Features

- use amphora ([d61acf7](https://github.com/lindorm-io/monorepo/commit/d61acf7f7de762f0a4980b9dd720ec62a5787ba1))

## [0.1.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/aegis@0.1.0...@lindorm/aegis@0.1.1) (2024-05-20)

### Bug Fixes

- update jwe with gcm keywrap ([0abbd3b](https://github.com/lindorm-io/monorepo/commit/0abbd3b26120dabe8e71223ea45b7c9beb14d4e9))

# 0.1.0 (2024-05-19)

### Features

- initialise aegis package ([b0eb954](https://github.com/lindorm-io/monorepo/commit/b0eb954d9015bd965a3120980edaceaff55e9ccb))
