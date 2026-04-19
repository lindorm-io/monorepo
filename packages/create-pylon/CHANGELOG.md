# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
