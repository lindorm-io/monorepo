# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.4.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/create-pylon@0.4.0...@lindorm/create-pylon@0.4.1) (2026-05-05)

### Bug Fixes

- **create-pylon:** seed pylon:kek with urn issuer ([3fb8b80](https://github.com/lindorm-io/monorepo/commit/3fb8b80af99453ac926a5c266a2c0681a35b0eaa))
- **create-pylon:** wire logger.readable through config ([2424856](https://github.com/lindorm-io/monorepo/commit/24248561b9e72fcddcfbaf6d0443e110f2a35dfb))

# [0.4.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/create-pylon@0.3.0...@lindorm/create-pylon@0.4.0) (2026-05-04)

### Features

- **create-pylon:** codegen default.yml and adopt \_\_ env-var convention ([a522f54](https://github.com/lindorm-io/monorepo/commit/a522f5434f8e0d674d7a108d99c3bb22a1c01ef1))
- **create-pylon:** codegen development.yml; split .env/.env.example ([0bf1983](https://github.com/lindorm-io/monorepo/commit/0bf19836f7dab12d8c7d1f550b16176317ef6d6d))

# [0.3.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/create-pylon@0.2.2...@lindorm/create-pylon@0.3.0) (2026-05-03)

### Features

- **create-pylon:** import WebhookSubscription from @lindorm/pylon/entities ([a186f35](https://github.com/lindorm-io/monorepo/commit/a186f3509aee518c42b0d680e137c1ba7d120dbd))

## [0.2.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/create-pylon@0.2.1...@lindorm/create-pylon@0.2.2) (2026-05-02)

### Bug Fixes

- **create-pylon:** resolve symlinked argv[1] in CLI entry-point guard ([cf7cbb9](https://github.com/lindorm-io/monorepo/commit/cf7cbb9a31936c2c9100e6e99714f821aae40bbd))

## [0.2.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/create-pylon@0.2.0...@lindorm/create-pylon@0.2.1) (2026-05-02)

### Bug Fixes

- **create-pylon:** drop stale audit.actor from generated pylon.ts ([0ec1964](https://github.com/lindorm-io/monorepo/commit/0ec19646ba7c70b8bbbfa513bc7e7590a66ef04b))

# [0.2.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/create-pylon@0.1.0...@lindorm/create-pylon@0.2.0) (2026-05-02)

### Bug Fixes

- **create-pylon:** mark parseAsync floating promise with void ([1328022](https://github.com/lindorm-io/monorepo/commit/13280220af688d373afd390ad203ec70ed2ed657))
- **create-pylon:** use public attach-source middleware in generated scaffolder output ([bf0ec2d](https://github.com/lindorm-io/monorepo/commit/bf0ec2da773c469049f347126ce765ee03f2f330))

### Features

- **create-pylon:** mount non-primary Proteus sources on ctx.<driver> ([6c169a7](https://github.com/lindorm-io/monorepo/commit/6c169a7af3620f6039ba64073281a3044fb43974))
- **create-pylon:** multi-driver proteus selection + per-driver sources ([9679366](https://github.com/lindorm-io/monorepo/commit/9679366d6a50bc964a8e7e6eb077bff98ac72b74))
- **create-pylon:** narrow nodeEnv to the Environment union and wire to pylon ([29a1f21](https://github.com/lindorm-io/monorepo/commit/29a1f21cd83e92f46e612ee70a6e13bfb0e2f513))
- **create-pylon:** pass scope: import.meta.url to configuration() ([f5e6ee9](https://github.com/lindorm-io/monorepo/commit/f5e6ee97e4c518536e87bceecf8bcf955de0f62d))
- **create-pylon:** per-env YAML config examples with logger.level ([5ee37d2](https://github.com/lindorm-io/monorepo/commit/5ee37d2b4fbc6c6e18d2da28b692eef22782ccf8))
- **create-pylon:** prefer fast stores for session, mirror rate-limit pattern ([7c0ec08](https://github.com/lindorm-io/monorepo/commit/7c0ec08df91dd8b770e07ce0488512e460984ccf))
- **create-pylon:** scaffold ESM projects on vitest ([ebdd771](https://github.com/lindorm-io/monorepo/commit/ebdd771102e60e96c33129eabbb6b3c101ae385d))
- **create-pylon:** wire package name and version into pylon options ([d99ceaa](https://github.com/lindorm-io/monorepo/commit/d99ceaa7d14ba1d2c147ae4956eeb71105edcbc3))
- migrate 20 packages from jest to vitest ([d8bfda8](https://github.com/lindorm-io/monorepo/commit/d8bfda8854dc1cb9537ba0b3e47ec4e4c7bded08))

# 0.1.0 (2026-04-19)

### Bug Fixes

- **create-pylon:** correct base dependency lists ([42f7aa3](https://github.com/lindorm-io/monorepo/commit/42f7aa344fbe8de8839e3bb3f9f02fab629145b5))
- **create-pylon:** correct webhook template import paths and tsconfig moduleResolution ([3bf7486](https://github.com/lindorm-io/monorepo/commit/3bf7486b07e119b4e6ce4ccf5a3e4df7e2cae00f))
- **create-pylon:** export renamed driver helpers from index ([efefc8e](https://github.com/lindorm-io/monorepo/commit/efefc8e6d5e155b0cb928c8eb35c4b3bc0a0bad6))
- **create-pylon:** install @lindorm/errors as a base runtime dependency ([a5c462e](https://github.com/lindorm-io/monorepo/commit/a5c462e43f254cc85c569a13c08ff70a853c4f7f))
- **create-pylon:** rename middleware templates to avoid http+socket collision ([bb04189](https://github.com/lindorm-io/monorepo/commit/bb04189e311dcde01bdd32a327b587092de79c26))
- **create-pylon:** skip git init when scaffolding inside existing repo ([c21e423](https://github.com/lindorm-io/monorepo/commit/c21e42323bb17244c5de9083ccde3c3142ac4e1e))
- **create-pylon:** use moduleResolution node16 instead of node10 ([3b06b26](https://github.com/lindorm-io/monorepo/commit/3b06b26e189d2a628fb54a7b8bf66f0b86d8019a))
- **create-pylon:** webhook schemas enforce entity enums and URL format ([cb0f2e1](https://github.com/lindorm-io/monorepo/commit/cb0f2e1c335be468b642cc56bd889d902dae12eb))

### Features

- **create-pylon:** add session, OIDC auth, rate limit prompts with typed config ([b0646df](https://github.com/lindorm-io/monorepo/commit/b0646dfa1b56fd72a814ec0ade881e7f7a478ee1))
- **create-pylon:** assemble config, pylon, docker-compose, workers, iris samples ([5955e3e](https://github.com/lindorm-io/monorepo/commit/5955e3edd27588dfda2d0d97fb646b25a76c77e6))
- **create-pylon:** enforce Node 24.13 via engines, drop Symbol.metadata polyfill ([98edd4f](https://github.com/lindorm-io/monorepo/commit/98edd4f9edff798fa9de46ac43c5192821b76d6d))
- **create-pylon:** generate and load a pylon:kek at scaffold time ([eab4f28](https://github.com/lindorm-io/monorepo/commit/eab4f2848ea3d1c4494740d637d3ba65df463bd7))
- **create-pylon:** initial scaffolding CLI with templates ([639ad8d](https://github.com/lindorm-io/monorepo/commit/639ad8d071a36add7bc3d3f49bbc7a2e96425ecd))
- **create-pylon:** use module + moduleResolution node16 in template ([7a368ad](https://github.com/lindorm-io/monorepo/commit/7a368adbca022684e58e46d99b1283b5cc222486))

### Reverts

- **create-pylon:** drop end-to-end scaffold integration test ([d520458](https://github.com/lindorm-io/monorepo/commit/d5204585afc547c1a2498e362fc77fa47e1c0d77))
- **create-pylon:** keep moduleResolution on node with ignoreDeprecations ([a02ebf9](https://github.com/lindorm-io/monorepo/commit/a02ebf9d9db66b9294a6f1944949829ffcdcd365))
