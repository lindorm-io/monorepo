# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.6.0 (2026-07-09)

### Bug Fixes

- **create-pylon:** accept an npm-scoped project name ([fe99a7a](https://github.com/lindorm-io/monorepo/commit/fe99a7a4d6a26779f559b0a21594df938914cc9d))
- **create-pylon:** add --passWithNoTests to generated test script ([af7a90f](https://github.com/lindorm-io/monorepo/commit/af7a90fefe65f2b0c485259b46eb3fc8a51e1814))
- **create-pylon:** add missing session feature in compose test fixture ([db89fe6](https://github.com/lindorm-io/monorepo/commit/db89fe6ea0615de7f80e861f4defcbee1000dfdc))
- **create-pylon:** bump compose images and surface docker:up next step ([c24551e](https://github.com/lindorm-io/monorepo/commit/c24551e44a4c9ae27f289f95de4214cf604acd2b))
- **create-pylon:** consistent none-last order; drop memory from the db prompt ([e5a73f0](https://github.com/lindorm-io/monorepo/commit/e5a73f07cddff5e04c765ffe7a26b1294f625bfd))
- **create-pylon:** correct base dependency lists ([245f053](https://github.com/lindorm-io/monorepo/commit/245f053c6eec8fd9f89dc8ac88881fcc8b55f210))
- **create-pylon:** correct generated config so a fresh scaffold boots as an OP ([75c4c84](https://github.com/lindorm-io/monorepo/commit/75c4c8448b9d6787fbb10a7c70818e787ba35aee))
- **create-pylon:** correct webhook template import paths and tsconfig moduleResolution ([33dde6c](https://github.com/lindorm-io/monorepo/commit/33dde6cf8d9380048899f7f3c743a0f0adba0b5e))
- **create-pylon:** drop stale audit.actor from generated pylon.ts ([8c72938](https://github.com/lindorm-io/monorepo/commit/8c72938151cd103663019772fcf95c6634edad9c))
- **create-pylon:** export renamed driver helpers from index ([fc9c295](https://github.com/lindorm-io/monorepo/commit/fc9c295590173af81f0051744fac94e5c4d8abf0))
- **create-pylon:** format generated project with prettier ([9362f88](https://github.com/lindorm-io/monorepo/commit/9362f88ae1f79f6f856ebe09be93bccb4de65faa))
- **create-pylon:** generate vitest config with swc decorator transform ([edcb0b4](https://github.com/lindorm-io/monorepo/commit/edcb0b401f16d0d73ebbc96959b3e2d211e99458))
- **create-pylon:** import primary nested source in worker templates ([32c7740](https://github.com/lindorm-io/monorepo/commit/32c7740af8a87674bd5772560c713206cef5bd94))
- **create-pylon:** install @lindorm/errors as a base runtime dependency ([9301145](https://github.com/lindorm-io/monorepo/commit/9301145ed2a50dc7e9f32aea81fcb0b70d4dd586))
- **create-pylon:** install proteus's @lindorm/aes encryption peer ([1e8f412](https://github.com/lindorm-io/monorepo/commit/1e8f412402964ad9c2dcb15edc9cc2f1419d59a7))
- **create-pylon:** mark parseAsync floating promise with void ([2297998](https://github.com/lindorm-io/monorepo/commit/2297998ce9b31906dafffcc927ddb4166d69dec3))
- **create-pylon:** rename middleware templates to avoid http+socket collision ([8a25864](https://github.com/lindorm-io/monorepo/commit/8a258643b10c102dbdef862570e6314b7a243b7c))
- **create-pylon:** resolve symlinked argv[1] in CLI entry-point guard ([3239f84](https://github.com/lindorm-io/monorepo/commit/3239f848a1e5b9fc996e07ded9f14016e8fd9116))
- **create-pylon:** seed pylon:kek with urn issuer ([e5199af](https://github.com/lindorm-io/monorepo/commit/e5199af9038a698b89ab390ad9c81c0540e8c98f))
- **create-pylon:** skip git init when scaffolding inside existing repo ([3268e9e](https://github.com/lindorm-io/monorepo/commit/3268e9ea021e4d269f8b87cf02c5bb6774abf0a5))
- **create-pylon:** use moduleResolution node16 instead of node10 ([62344e5](https://github.com/lindorm-io/monorepo/commit/62344e5f624f93ef73d037a90128f69fbe9fc208))
- **create-pylon:** use public attach-source middleware in generated scaffolder output ([a23244e](https://github.com/lindorm-io/monorepo/commit/a23244e76978881277e034cbd3d998948b9dc614))
- **create-pylon:** use zod-4 .prefault({}) in generated config ([4d09f23](https://github.com/lindorm-io/monorepo/commit/4d09f23768a3c75f2b8efbdaa6c95c9724bf2682))
- **create-pylon:** webhook schemas enforce entity enums and URL format ([c27ec42](https://github.com/lindorm-io/monorepo/commit/c27ec42e25987b1f62c1bc093e3c2239d9832f39))
- **create-pylon:** wire logger.readable through config ([5aa53d8](https://github.com/lindorm-io/monorepo/commit/5aa53d82ecfe0a7e8de8288b962997208bb4f736))

### Features

- **create-pylon:** add session, OIDC auth, rate limit prompts with typed config ([1b377cb](https://github.com/lindorm-io/monorepo/commit/1b377cb001f028fe239aae297926f4508b147c2e))
- **create-pylon:** assemble config, pylon, docker-compose, workers, iris samples ([39800d1](https://github.com/lindorm-io/monorepo/commit/39800d10c372870bb8bdb169ca04ba89c7c46d78))
- **create-pylon:** codegen default.yml and adopt \_\_ env-var convention ([f04fff9](https://github.com/lindorm-io/monorepo/commit/f04fff9ae9d4cd5a9aa8a7e5f909d9d7c6db5111))
- **create-pylon:** codegen development.yml; split .env/.env.example ([8f15c39](https://github.com/lindorm-io/monorepo/commit/8f15c397a10290d932ec3f6900d4257ca9e10c94))
- **create-pylon:** echo the exact npm install command before running it ([65aa6cb](https://github.com/lindorm-io/monorepo/commit/65aa6cbf5f75bf0f6878755a991d40aae2f4eb4c))
- **create-pylon:** enforce Node 24.13 via engines, drop Symbol.metadata polyfill ([8fbdb9b](https://github.com/lindorm-io/monorepo/commit/8fbdb9bba3d71e11c70b149dcc51e08bb8d73d03))
- **create-pylon:** generate and load a pylon:kek at scaffold time ([8e79a1c](https://github.com/lindorm-io/monorepo/commit/8e79a1cfb069b1ea5e2c8b7f29a56760c5ab6c35))
- **create-pylon:** generate db/kv pylon options, wire ctx.kv ([c6feb3c](https://github.com/lindorm-io/monorepo/commit/c6feb3c4fb4538acf975c415bd07825067fe9dd2))
- **create-pylon:** generate lindorm.config + make scaffold() self-contained ([694fb08](https://github.com/lindorm-io/monorepo/commit/694fb085adef7aa0af3cddd19388601aeb56a012))
- **create-pylon:** import WebhookSubscription from @lindorm/pylon/entities ([88290e9](https://github.com/lindorm-io/monorepo/commit/88290e978625b532ad2fcb7de736b37d30db0aff))
- **create-pylon:** initial scaffolding CLI with templates ([add781f](https://github.com/lindorm-io/monorepo/commit/add781fe08a9e0c731475e110a504df9f8da4754))
- **create-pylon:** manage dev/test docker services via composed ([917468c](https://github.com/lindorm-io/monorepo/commit/917468cddb4f2a83fce7048b54f51663953ce87d))
- **create-pylon:** mount non-primary Proteus sources on ctx.<driver> ([3b0822b](https://github.com/lindorm-io/monorepo/commit/3b0822bfb3cb93e79641d1036e060417f6944075))
- **create-pylon:** multi-driver proteus selection + per-driver sources ([f7e2628](https://github.com/lindorm-io/monorepo/commit/f7e26284636ccda3e355b32e3b0bc98e0103f46a))
- **create-pylon:** narrow nodeEnv to the Environment union and wire to pylon ([14a6925](https://github.com/lindorm-io/monorepo/commit/14a69257a2e49506e584d6085cb71f607dbce152))
- **create-pylon:** pass scope: import.meta.url to configuration() ([412de7d](https://github.com/lindorm-io/monorepo/commit/412de7dbf72fd5b7a0cb5d63a5d75422c9e5b691))
- **create-pylon:** per-env YAML config examples with logger.level ([35b6983](https://github.com/lindorm-io/monorepo/commit/35b69830535018aa4e9e9f27fd001b5809a644e0))
- **create-pylon:** prefer fast stores for session, mirror rate-limit pattern ([aef99b5](https://github.com/lindorm-io/monorepo/commit/aef99b52f6c07d427be899518fa435ab9e4aeb42))
- **create-pylon:** rename irisDriver answer field to bus ([1b1d639](https://github.com/lindorm-io/monorepo/commit/1b1d639001e793b8a4c7c20be3a3184ecf2f4233))
- **create-pylon:** scaffold a **fixtures** test-ctx helper ([4540efa](https://github.com/lindorm-io/monorepo/commit/4540efad37427d7a1b0576b59d1d4511517dd690))
- **create-pylon:** scaffold ESM projects on vitest ([f259557](https://github.com/lindorm-io/monorepo/commit/f2595572df77b7d7ea4ada0f89c383df271a86bf))
- **create-pylon:** scaffold snake naming and config-driven sync/migrations ([5e1cc40](https://github.com/lindorm-io/monorepo/commit/5e1cc4005c4a87d02697f8450d30ed1593d26ad9))
- **create-pylon:** single db + single kv store selects, not a driver checkbox ([07b3e2c](https://github.com/lindorm-io/monorepo/commit/07b3e2cc550fc6734ecc92292a17bcf7c298c87e))
- **create-pylon:** use module + moduleResolution node16 in template ([cec97b8](https://github.com/lindorm-io/monorepo/commit/cec97b8b50766ceab27b48e64c1751bb3c3e5c73))
- **create-pylon:** wire amphora into scaffolded proteus sources ([ffd1c13](https://github.com/lindorm-io/monorepo/commit/ffd1c1352b36d4bfe6e24a06ded5567cd9e122bf))
- **create-pylon:** wire package name and version into pylon options ([d8c48fd](https://github.com/lindorm-io/monorepo/commit/d8c48fdca521f55125625982d503c240348fb1ac))
- **create-pylon:** wire pylon by driver-named source imports ([8c517c0](https://github.com/lindorm-io/monorepo/commit/8c517c015218f33b2d9f6a24f00a1e6bed6dfd6d))
- migrate 20 packages from jest to vitest ([e9d3c7a](https://github.com/lindorm-io/monorepo/commit/e9d3c7ad717b15fee223451242eb8d7bb71edf4a))

### Reverts

- **create-pylon:** drop end-to-end scaffold integration test ([7ac9946](https://github.com/lindorm-io/monorepo/commit/7ac9946da7d97bb335bc6bda1127f7cbdb40ed34))
- **create-pylon:** keep moduleResolution on node with ignoreDeprecations ([41f4c3a](https://github.com/lindorm-io/monorepo/commit/41f4c3aca258801a3e53294de91e3454b45a2f61))

## [0.5.5](https://github.com/lindorm-io/monorepo/compare/@lindorm/create-pylon@0.5.4...@lindorm/create-pylon@0.5.5) (2026-07-04)

**Note:** Version bump only for package @lindorm/create-pylon

## [0.5.4](https://github.com/lindorm-io/monorepo/compare/@lindorm/create-pylon@0.5.3...@lindorm/create-pylon@0.5.4) (2026-07-02)

### Bug Fixes

- **create-pylon:** accept an npm-scoped project name ([b79f6f4](https://github.com/lindorm-io/monorepo/commit/b79f6f4bbec10950ae9d00ec170914ac7512bbc0))
- **create-pylon:** add --passWithNoTests to generated test script ([23e6816](https://github.com/lindorm-io/monorepo/commit/23e6816f3e37f1473182464b74f34d1617ed657e))
- **create-pylon:** format generated project with prettier ([3ae8ad7](https://github.com/lindorm-io/monorepo/commit/3ae8ad7d68082b718849a75924742e2de0d7cf14))
- **create-pylon:** generate vitest config with swc decorator transform ([21c9d89](https://github.com/lindorm-io/monorepo/commit/21c9d89a68ccd14f401d7a2fc4a2949ec6095f1a))
- **create-pylon:** install proteus's @lindorm/aes encryption peer ([561f43f](https://github.com/lindorm-io/monorepo/commit/561f43fe3b28a01596dd60c14ef0f0252cf03aa2))
- **create-pylon:** use zod-4 .prefault({}) in generated config ([085ec65](https://github.com/lindorm-io/monorepo/commit/085ec650a9bfaf3d4264ca1fd71abed469f53794))

## [0.5.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/create-pylon@0.5.2...@lindorm/create-pylon@0.5.3) (2026-06-19)

**Note:** Version bump only for package @lindorm/create-pylon

## [0.5.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/create-pylon@0.5.1...@lindorm/create-pylon@0.5.2) (2026-06-15)

**Note:** Version bump only for package @lindorm/create-pylon

## [0.5.1](https://github.com/lindorm-io/monorepo/compare/@lindorm/create-pylon@0.5.0...@lindorm/create-pylon@0.5.1) (2026-06-05)

**Note:** Version bump only for package @lindorm/create-pylon

# [0.5.0](https://github.com/lindorm-io/monorepo/compare/@lindorm/create-pylon@0.4.3...@lindorm/create-pylon@0.5.0) (2026-05-05)

### Features

- **create-pylon:** scaffold snake naming and config-driven sync/migrations ([0451645](https://github.com/lindorm-io/monorepo/commit/0451645d7732ee4d11a04adac79801d99a9664f5))
- **create-pylon:** wire amphora into scaffolded proteus sources ([13f9a40](https://github.com/lindorm-io/monorepo/commit/13f9a40dc849bb316d3fcd43e2ec492689ea9678))

## [0.4.3](https://github.com/lindorm-io/monorepo/compare/@lindorm/create-pylon@0.4.2...@lindorm/create-pylon@0.4.3) (2026-05-05)

### Bug Fixes

- **create-pylon:** bump compose images and surface docker:up next step ([c133772](https://github.com/lindorm-io/monorepo/commit/c133772f33ac792b8a6e5795a0b275136606c135))

## [0.4.2](https://github.com/lindorm-io/monorepo/compare/@lindorm/create-pylon@0.4.1...@lindorm/create-pylon@0.4.2) (2026-05-05)

### Bug Fixes

- **create-pylon:** import primary nested source in worker templates ([1cbf174](https://github.com/lindorm-io/monorepo/commit/1cbf1749a6666df935e8a0cd78a470b521e59417))

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
