# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.10.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.3.3...@lindorm/conduit@0.10.0) (2026-07-09)

### Bug Fixes

- **conduit:** add origin to RequestContext fixtures and fix breaker middleware test args ([d319108](https://github.com/lindorm-io/monorepo/commit/d31910835aaf8244a2ed9b657b9a1d665f8ecf5a))
- **conduit:** add sensitive header redaction and OIDC token endpoint validation ([4c3778a](https://github.com/lindorm-io/monorepo/commit/4c3778a2f0b2a6428de8c174880b7d191cb1063b))
- **conduit:** force axios http adapter so nock can intercept in tests ([5103631](https://github.com/lindorm-io/monorepo/commit/5103631a97ec0cea495d45cf790a9840ca8820e2))
- **conduit:** make base64/buffer paths browser-safe ([235a28a](https://github.com/lindorm-io/monorepo/commit/235a28aeb2beca8e6cf9df389bfd95fd2c4ae281))
- **conduit:** normalize request method to uppercase and tighten ConfigContext ([a14c7b2](https://github.com/lindorm-io/monorepo/commit/a14c7b2ac7b138b563cd04707178a54e426de032))
- **conduit:** resolve circuit breaker and retry reliability issues ([9997e8f](https://github.com/lindorm-io/monorepo/commit/9997e8fe981d884ce0457652eb5238041a206486))
- **conduit:** resolve critical bugs in schema validation, token caching, and request composition ([6a425f1](https://github.com/lindorm-io/monorepo/commit/6a425f19df9fc5ec46092210c343fb2e31f49d27))
- **conduit:** resolve OAuth2 token stampede and data composition bugs ([8816da9](https://github.com/lindorm-io/monorepo/commit/8816da941b65b71775083b2365bda175a132aa32))
- **conduit:** surface invalid schema as 500 instead of swallowing it ([7720373](https://github.com/lindorm-io/monorepo/commit/7720373a779a6bed92c73b6e87dbe89c8be8ec39))
- declare zod as a peerDependency on packages with zod-typed public APIs ([790bc68](https://github.com/lindorm-io/monorepo/commit/790bc689aa8e9450f74c3e880cbe3825a0d680ae))
- **eslint:** forbid redundant public via explicit-member-accessibility no-public ([e759b1f](https://github.com/lindorm-io/monorepo/commit/e759b1f1c552b50d150aecca51488eac64856d91))
- **packages:** declare files: ["dist"] for every publishable package ([b8d29fc](https://github.com/lindorm-io/monorepo/commit/b8d29fc24996a02636ddecc11c5d25da4930ef11))
- widen @lindorm/\* peer ranges to unbounded >= ([9655dec](https://github.com/lindorm-io/monorepo/commit/9655dec5ce8d66b4691faa98352980bef11a466e))

### Features

- **conduit:** add conduitUserAgentMiddleware for x-user-agent-\* headers ([13319bd](https://github.com/lindorm-io/monorepo/commit/13319bd19ea3104418dd774cc54ae6eed39f0374))
- **conduit:** add createMockConduit mock factory ([e0d9477](https://github.com/lindorm-io/monorepo/commit/e0d9477849131586982e82b1bec291f1063c6c94))
- **conduit:** add DPoP auth middleware and Web Crypto signer ([7a7f66e](https://github.com/lindorm-io/monorepo/commit/7a7f66ed28fc155ca12803a69748929c28927318))
- **conduit:** add fetch engine parity with abort, streaming, progress, and network retry ([dfa0b5f](https://github.com/lindorm-io/monorepo/commit/dfa0b5fd8a080cdad5923be3dcb08d84ae327860))
- **conduit:** add rate limiting, response caching, request deduplication, and retry hook ([fcda644](https://github.com/lindorm-io/monorepo/commit/fcda644132a4ef36139942642b1ada08279f452f))
- **conduit:** add titles and details to thrown errors ([08dd781](https://github.com/lindorm-io/monorepo/commit/08dd78192417d5c6472f2a6ef7debeaa05b5abbd))
- **conduit:** driver-based response cache with pluggable drivers ([f296301](https://github.com/lindorm-io/monorepo/commit/f296301b967f3fe6afaeabc52462ae134b5c2f76))
- **conduit:** expose axios adapter as conduit option ([9135573](https://github.com/lindorm-io/monorepo/commit/91355734430d0e4401612de19349fe9fa79ee84c))
- **conduit:** forward error type urn during reconstruction ([a75357f](https://github.com/lindorm-io/monorepo/commit/a75357f610e5a83caf64a15d424d1e3778f5a3c1))
- **conduit:** infer cache provenance into response.cached ([37d0831](https://github.com/lindorm-io/monorepo/commit/37d08315908290a94ddf86fe34589c939afc1be3))
- **conduit:** namespace and enrich thrown errors ([612f33f](https://github.com/lindorm-io/monorepo/commit/612f33fd8637c21dac27bd3adad1af81b4b53f90))
- **conduit:** namespaced lindorm ids for request context ([38af9e9](https://github.com/lindorm-io/monorepo/commit/38af9e9aeb14d67ec1a0403dc8883ec815000f08))
- **conduit:** support DPoP-bound tokens in client credentials flow ([6ef00db](https://github.com/lindorm-io/monorepo/commit/6ef00db3f4a74e2773c05d60df8146fda1fcbcfd))
- migrate 20 packages from jest to vitest ([e9d3c7a](https://github.com/lindorm-io/monorepo/commit/e9d3c7ad717b15fee223451242eb8d7bb71edf4a))

# [0.9.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.8.0...@lindorm/conduit@0.9.0) (2026-07-02)

### Bug Fixes

- declare zod as a peerDependency on packages with zod-typed public APIs ([eb46f80](https://github.com/lindorm-io/monorepo/commit/eb46f802ccaacf92a06250440edd7df97b57e5e6))
- **eslint:** forbid redundant public via explicit-member-accessibility no-public ([0ca0e95](https://github.com/lindorm-io/monorepo/commit/0ca0e953509d6d28baabcbc5233c1a17e6e6efa0))

### Features

- **conduit:** add conduitUserAgentMiddleware for x-user-agent-\* headers ([34ccab6](https://github.com/lindorm-io/monorepo/commit/34ccab688237d5dbaa30251b4ceb000c15752952))

# [0.8.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.7.0...@lindorm/conduit@0.8.0) (2026-06-19)

### Features

- **conduit:** namespaced lindorm ids for request context ([6609936](https://github.com/lindorm-io/monorepo/commit/66099367c311831fc8431f26e6c27e08f3af92c4))

# [0.7.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.6.3...@lindorm/conduit@0.7.0) (2026-06-15)

### Bug Fixes

- **conduit:** surface invalid schema as 500 instead of swallowing it ([4618ee3](https://github.com/lindorm-io/monorepo/commit/4618ee391e19002b8220d5cae135b86856dbfe97))

### Features

- **conduit:** add titles and details to thrown errors ([2e2b5ba](https://github.com/lindorm-io/monorepo/commit/2e2b5ba58bd3f9d472accf426ebd1608fdedf8ab))
- **conduit:** forward error type urn during reconstruction ([ca906b8](https://github.com/lindorm-io/monorepo/commit/ca906b826517a32cb79e6ab561c17a4a073c2715))
- **conduit:** namespace and enrich thrown errors ([15ef67a](https://github.com/lindorm-io/monorepo/commit/15ef67a282b4469afc42dfac99610f52c0aafb0e))

## [0.6.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.6.2...@lindorm/conduit@0.6.3) (2026-06-05)

**Note:** Version bump only for package @lindorm/conduit

## [0.6.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.6.1...@lindorm/conduit@0.6.2) (2026-05-05)

### Bug Fixes

- **packages:** declare files: ["dist"] for every publishable package ([6fe2ac8](https://github.com/lindorm-io/monorepo/commit/6fe2ac818d0deba7e68f799b7f856c7ebf419832))

## [0.6.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.6.0...@lindorm/conduit@0.6.1) (2026-05-05)

**Note:** Version bump only for package @lindorm/conduit

# [0.6.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.5.1...@lindorm/conduit@0.6.0) (2026-05-02)

### Bug Fixes

- widen @lindorm/\* peer ranges to unbounded >= ([f192b59](https://github.com/lindorm-io/monorepo/commit/f192b59107bf1f276d296837f40fa97765d9d2ba))

### Features

- migrate 20 packages from jest to vitest ([d8bfda8](https://github.com/lindorm-io/monorepo/commit/d8bfda8854dc1cb9537ba0b3e47ec4e4c7bded08))

## [0.5.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.5.0...@lindorm/conduit@0.5.1) (2026-04-19)

**Note:** Version bump only for package @lindorm/conduit

# [0.5.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.4.4...@lindorm/conduit@0.5.0) (2026-04-15)

### Bug Fixes

- **conduit:** force axios http adapter so nock can intercept in tests ([784bdd2](https://github.com/lindorm-io/monorepo/commit/784bdd28408d5b42325b58abb3bf78de9ee23f39))
- **conduit:** normalize request method to uppercase and tighten ConfigContext ([699614e](https://github.com/lindorm-io/monorepo/commit/699614e85693fa730025e8b9ee0887949a93f3c1))

### Features

- **conduit:** add DPoP auth middleware and Web Crypto signer ([d2e162e](https://github.com/lindorm-io/monorepo/commit/d2e162e1e2ca614e10ab1671ad0de8688d466625))
- **conduit:** expose axios adapter as conduit option ([933aa6f](https://github.com/lindorm-io/monorepo/commit/933aa6f2fb2258fa05afc0dad717913f51f86f53))
- **conduit:** support DPoP-bound tokens in client credentials flow ([d08ed89](https://github.com/lindorm-io/monorepo/commit/d08ed89ee955180cd33dd1c9fc358808bd0c0cf8))

## [0.4.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.4.3...@lindorm/conduit@0.4.4) (2026-04-01)

### Bug Fixes

- **conduit:** add origin to RequestContext fixtures and fix breaker middleware test args ([70ad1f8](https://github.com/lindorm-io/monorepo/commit/70ad1f8ee5f7e215fe589e5a32a3e255173b0aae))

## [0.4.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.4.2...@lindorm/conduit@0.4.3) (2026-03-29)

**Note:** Version bump only for package @lindorm/conduit

## [0.4.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.4.1...@lindorm/conduit@0.4.2) (2026-03-13)

**Note:** Version bump only for package @lindorm/conduit

## [0.4.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.4.0...@lindorm/conduit@0.4.1) (2026-03-13)

**Note:** Version bump only for package @lindorm/conduit

# [0.4.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.3.3...@lindorm/conduit@0.4.0) (2026-02-17)

### Bug Fixes

- **conduit:** add sensitive header redaction and OIDC token endpoint validation ([4c3778a](https://github.com/lindorm-io/monorepo/commit/4c3778a2f0b2a6428de8c174880b7d191cb1063b))
- **conduit:** resolve circuit breaker and retry reliability issues ([9997e8f](https://github.com/lindorm-io/monorepo/commit/9997e8fe981d884ce0457652eb5238041a206486))
- **conduit:** resolve critical bugs in schema validation, token caching, and request composition ([6a425f1](https://github.com/lindorm-io/monorepo/commit/6a425f19df9fc5ec46092210c343fb2e31f49d27))
- **conduit:** resolve OAuth2 token stampede and data composition bugs ([8816da9](https://github.com/lindorm-io/monorepo/commit/8816da941b65b71775083b2365bda175a132aa32))

### Features

- **conduit:** add fetch engine parity with abort, streaming, progress, and network retry ([dfa0b5f](https://github.com/lindorm-io/monorepo/commit/dfa0b5fd8a080cdad5923be3dcb08d84ae327860))
- **conduit:** add rate limiting, response caching, request deduplication, and retry hook ([fcda644](https://github.com/lindorm-io/monorepo/commit/fcda644132a4ef36139942642b1ada08279f452f))

## [0.3.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.3.2...@lindorm/conduit@0.3.3) (2025-09-18)

**Note:** Version bump only for package @lindorm/conduit

## [0.3.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.3.1...@lindorm/conduit@0.3.2) (2025-07-19)

### Bug Fixes

- remove unnecessary enums ([d0364d9](https://github.com/lindorm-io/monorepo/commit/d0364d97ad0dc621a1020d4ddba8d3a87959838d))

## [0.3.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.3.0...@lindorm/conduit@0.3.1) (2025-07-10)

**Note:** Version bump only for package @lindorm/conduit

# [0.3.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.2.1...@lindorm/conduit@0.3.0) (2025-07-02)

### Bug Fixes

- add replace url ([7fa3bfe](https://github.com/lindorm-io/monorepo/commit/7fa3bfe3350a03af886abf7727d0696fc7b2727f))
- amend bug with audience ([d393f9c](https://github.com/lindorm-io/monorepo/commit/d393f9c9495e7b5f53eb289e65fc894c8a1126a4))
- make replace url ephemeral ([f86c963](https://github.com/lindorm-io/monorepo/commit/f86c963446f43538bad32d8060117a7971a31a2a))

### Features

- add circuit breaker middleware ([cba41a4](https://github.com/lindorm-io/monorepo/commit/cba41a4cdfc302500d4112aa586b920bac4c94f6))

## [0.2.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.2.0...@lindorm/conduit@0.2.1) (2025-06-24)

### Bug Fixes

- amend issues with client credentials middlware ([72947ee](https://github.com/lindorm-io/monorepo/commit/72947eee035707c77ba59e867aedde1d51e7c3bd))

# [0.2.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.1.8...@lindorm/conduit@0.2.0) (2025-06-17)

### Bug Fixes

- add expected response and session id ([235325c](https://github.com/lindorm-io/monorepo/commit/235325c94696f42c0c1cabdbc9a18638e7d41c83))
- remove 500 from default retry ([0e3862c](https://github.com/lindorm-io/monorepo/commit/0e3862c37c48b12c6a252a4fea0c10b4060a92b1))
- solve issue with pylon error ([dd93387](https://github.com/lindorm-io/monorepo/commit/dd9338704f3d96e4393587b560889af4aae8c073))

### Features

- add schema middleware for response data ([845c9b3](https://github.com/lindorm-io/monorepo/commit/845c9b3501ff35b7947caf5920bf21eba0e2767b))

## [0.1.8](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.1.7...@lindorm/conduit@0.1.8) (2025-01-28)

**Note:** Version bump only for package @lindorm/conduit

## [0.1.7](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.1.6...@lindorm/conduit@0.1.7) (2024-10-12)

**Note:** Version bump only for package @lindorm/conduit

## [0.1.6](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.1.5...@lindorm/conduit@0.1.6) (2024-09-25)

**Note:** Version bump only for package @lindorm/conduit

## [0.1.5](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.1.4...@lindorm/conduit@0.1.5) (2024-09-20)

### Bug Fixes

- improve logging capabilities of factory functions ([e510a56](https://github.com/lindorm-io/monorepo/commit/e510a5679843e5120df87d60b864d2274647dc25))

## [0.1.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.1.3...@lindorm/conduit@0.1.4) (2024-05-20)

### Bug Fixes

- update client credentials middleware and move files ([9e97fdd](https://github.com/lindorm-io/monorepo/commit/9e97fdd74be547db33eafead56a0ad6d87744871))

## [0.1.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.1.2...@lindorm/conduit@0.1.3) (2024-05-19)

### Bug Fixes

- amend faulty form data handling ([c46c419](https://github.com/lindorm-io/monorepo/commit/c46c41965d75229636ef529a745aa70159233a46))

## [0.1.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.1.1...@lindorm/conduit@0.1.2) (2024-05-11)

### Bug Fixes

- align with retry config ([6e8094b](https://github.com/lindorm-io/monorepo/commit/6e8094b59469c450f5d6fc05ee2cd4e23d21c1ca))

## [0.1.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/conduit@0.1.0...@lindorm/conduit@0.1.1) (2024-05-10)

### Bug Fixes

- add client credentials middleware ([340d4f1](https://github.com/lindorm-io/monorepo/commit/340d4f1227f37b98f0d7c5a274b01d63fe74c9ea))

# 0.1.0 (2024-05-10)

### Features

- initialise conduit package ([42a863f](https://github.com/lindorm-io/monorepo/commit/42a863f924cac05c5220bbc82e4a193c7b781d62))
