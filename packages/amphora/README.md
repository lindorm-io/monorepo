# @lindorm/amphora

Cryptographic key vault for managing [Kryptos](https://www.npmjs.com/package/@lindorm/kryptos) keys. Stores local keys, serves them as JWKS, and discovers keys from external OpenID Connect providers.

## Installation

```bash
npm install @lindorm/amphora
```

This package is **ESM-only**. Import with `import`, not `require`. It does not declare an `engines.node` constraint.

To construct an `Amphora`, the consumer must also supply an `ILogger` instance from [`@lindorm/logger`](https://www.npmjs.com/package/@lindorm/logger). Code samples below use `KryptosKit` from [`@lindorm/kryptos`](https://www.npmjs.com/package/@lindorm/kryptos), which is re-used through the public API.

## Table of Contents

- [Quick Start](#quick-start)
- [Constructor](#constructor)
- [Adding Keys](#adding-keys)
- [Finding Keys](#finding-keys)
- [JWKS Endpoint](#jwks-endpoint)
- [External Providers](#external-providers)
- [Trust Anchors](#trust-anchors)
- [Capability Checks](#capability-checks)
- [Properties](#properties)
- [Errors](#errors)
- [Testing With Mocks](#testing-with-mocks)
- [API Reference](#api-reference)
- [License](#license)

## Quick Start

```typescript
import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createLogger } from "@lindorm/logger";

const amphora = new Amphora({
  domain: "https://auth.example.com",
  logger: createLogger(),
});

const key = KryptosKit.generate.sig.ec({ algorithm: "ES512" });
amphora.add(key);

const found = await amphora.find({ use: "sig" });
```

## Constructor

```typescript
new Amphora({
  domain: "https://auth.example.com",
  logger,
  external: [{ issuer: "https://accounts.google.com" }],
  maxExternalKeys: 100,
  refreshInterval: 300_000,
});
```

| Option            | Type                           | Default   | Description                                                                                                                                                                         |
| ----------------- | ------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logger`          | `ILogger`                      | required  | Logger instance from `@lindorm/logger`.                                                                                                                                             |
| `domain`          | `string`                       | `null`    | The server's domain. Used as the default `issuer` and `jwksUri` for added keys, and as the filter for which keys appear in `amphora.jwks`. Validated as a URL at construction time. |
| `external`        | `Array<AmphoraExternalOption>` | `[]`      | External OIDC providers to discover keys from.                                                                                                                                      |
| `maxExternalKeys` | `number`                       | `100`     | Maximum number of keys accepted per external provider; excess keys are truncated.                                                                                                   |
| `refreshInterval` | `number`                       | `300_000` | Milliseconds before externally-fetched keys are considered stale.                                                                                                                   |

## Adding Keys

### From `IKryptos` instances

```typescript
const sigKey = KryptosKit.generate.sig.ec({ algorithm: "ES512" });
const encKey = KryptosKit.generate.enc.okp({ algorithm: "ECDH-ES", curve: "X25519" });

amphora.add(sigKey);
amphora.add([sigKey, encKey]);
```

When `domain` is set, Amphora auto-assigns `issuer` and `jwksUri` to added keys that don't already have them. Keys are deduplicated by `id` — adding a key with the same id replaces the previous one. Keys without an `id`, without an `issuer` (when no `domain` is set), or that are already expired are rejected with `AmphoraError`.

### From environment-encoded strings

`Amphora.env()` accepts compact `kryptos:`-prefixed strings (the format produced by `KryptosKit.env.import` / `export`) and adds them to the vault.

```typescript
amphora.env(process.env.SIGNING_KEY!);
amphora.env([process.env.SIGNING_KEY!, process.env.ENCRYPTION_KEY!]);
```

## Finding Keys

### Async — refreshes external providers when needed

`find()` and `filter()` consult the local vault first. If external providers are configured and the cache is stale (or empty for the query), they trigger a refresh before resolving. The first async call also performs the initial `setup()` automatically.

```typescript
const key = await amphora.find({ id: "some-uuid" });
const keys = await amphora.filter({ use: "sig", type: "EC" });

const byId = await amphora.findById("some-uuid");
```

`find()` and `findById()` throw `AmphoraError` when no match is found.

### Sync — local vault only

The sync methods never make network calls. If external providers are configured, `setup()` must have completed first or the call throws.

```typescript
const key = amphora.findSync({ id: "some-uuid" });
const byId = amphora.findByIdSync("some-uuid");
const keys = amphora.filterSync({ use: "enc" });
```

### Query format

Queries are predicates over key attributes. Plain values are equality checks; MongoDB-style operators are supported for richer filters via `@lindorm/utils`.

```typescript
await amphora.filter({ use: "sig", type: "EC" });

await amphora.filter({ algorithm: { $in: ["ES256", "ES384", "ES512"] } });

await amphora.filter({
  $or: [{ operations: { $in: ["encrypt"] } }, { operations: { $in: ["deriveKey"] } }],
});
```

Available query fields (from `AmphoraQuery`):

| Field                   | Type                              | Description                                                                                       |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `id`                    | `string`                          | Key id.                                                                                           |
| `algorithm`             | `string`                          | JOSE algorithm (e.g. `ES512`, `RS256`, `EdDSA`).                                                  |
| `certificateThumbprint` | `string`                          | SHA-256 thumbprint of the leaf certificate.                                                       |
| `curve`                 | `string`                          | EC/OKP curve (e.g. `P-256`, `Ed25519`, `X25519`).                                                 |
| `encryption`            | `string`                          | Content encryption algorithm (e.g. `A256GCM`).                                                    |
| `hasPrivateKey`         | `boolean`                         | Whether the key contains private material.                                                        |
| `hasPublicKey`          | `boolean`                         | Whether the key contains public material.                                                         |
| `isExternal`            | `boolean`                         | Whether the key was imported from an external provider.                                           |
| `issuer`                | `string`                          | Issuing authority URL.                                                                            |
| `operations`            | `Array<KeyOperation>`             | Allowed operations (`sign`, `verify`, `encrypt`, `decrypt`, `deriveKey`, `wrapKey`, `unwrapKey`). |
| `ownerId`               | `string`                          | Tenant/owner identifier.                                                                          |
| `purpose`               | `string`                          | Caller-defined key purpose.                                                                       |
| `type`                  | `"EC" \| "RSA" \| "oct" \| "OKP"` | Key type.                                                                                         |
| `use`                   | `"sig" \| "enc"`                  | Signature or encryption.                                                                          |

All query results are filtered to active keys only (excludes expired and not-yet-valid keys) and sorted newest-first by creation date.

## JWKS Endpoint

When `domain` is set, `amphora.jwks` returns the public JWKS for keys that match the configured domain. External keys, hidden keys, expired keys, and keys without public material are excluded. Accessing `jwks` without a configured `domain` throws `AmphoraError`.

```typescript
app.get("/.well-known/jwks.json", (req, res) => {
  res.json(amphora.jwks);
});
```

The `jwks` getter returns `{ keys: Array<LindormJwk> }`. Keys are sorted newest-first by creation date. Not-yet-active keys (with a future `notBefore`) are included so consumers can pre-cache them; expired keys are excluded.

## External Providers

Amphora can discover and cache keys from external OpenID Connect providers. Each entry in `external` must take one of three forms.

```typescript
new Amphora({
  domain: "https://auth.example.com",
  logger,
  external: [
    // 1. Issuer URL only — discovers via {issuer}/.well-known/openid-configuration
    { issuer: "https://accounts.google.com" },

    // 2. Issuer + JWKS URI directly — skips OpenID discovery
    {
      issuer: "https://partner-api.com/",
      jwksUri: "https://partner-api.com/.well-known/jwks.json",
    },

    // 3. Explicit OpenID configuration URI
    {
      openIdConfigurationUri:
        "https://login.microsoftonline.com/v2.0/.well-known/openid-configuration",
    },
  ],
});
```

Each entry also accepts:

| Field                 | Type                           | Description                                                                                                                          |
| --------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `openIdConfiguration` | `Partial<OpenIdConfiguration>` | Override or supplement values from the discovery document.                                                                           |
| `trustAnchors`        | `string \| Array<string>`      | PEM-encoded CA certificate(s) used to validate the certificate chains attached to fetched JWKs. See [Trust Anchors](#trust-anchors). |
| `trustMode`           | `"strict" \| "lax"`            | How to handle fetched keys without a certificate chain when `trustAnchors` is set. Default `"strict"`.                               |

### Refresh behaviour

- `setup()` is lazy — the first `find()` or `filter()` call triggers it automatically if external providers are configured. `findSync()` / `filterSync()` / `findByIdSync()` throw if invoked beforehand.
- Concurrent calls to `setup()` or `refresh()` are deduplicated; only one network round-trip is in flight at a time.
- After setup, async lookups re-fetch external keys when the cache is older than `refreshInterval`. If the local vault already satisfies the query and the cache is fresh, no network call is made.
- Partial failures are tolerated: if some providers fail but at least one succeeds, the vault is updated with what's available. If every configured provider fails, refresh throws `AmphoraError`.
- Fetched keys whose `iss` claim does not match the configured `issuer` are rejected to prevent issuer spoofing.

```typescript
await amphora.setup();
await amphora.refresh();
```

## Trust Anchors

Setting `trustAnchors` on an external provider entry pins the CAs that must sign certificates attached to fetched JWKs. The behavior depends on `trustMode`:

- **`strict` (default)** — every fetched JWK must include an `x5c` chain that validates against one of the supplied anchors. Keys without a chain are rejected.
- **`lax`** — keys without an `x5c` chain are accepted; keys that do include a chain still need to validate against the anchors.

```typescript
new Amphora({
  domain: "https://auth.example.com",
  logger,
  external: [
    {
      issuer: "https://partner.example.com/",
      jwksUri: "https://partner.example.com/.well-known/jwks.json",
      trustAnchors: PARTNER_ROOT_CA_PEM,
      trustMode: "strict",
    },
  ],
});
```

`trustAnchors` accepts a single PEM string or an array of PEM strings. Trust validation runs per JWK; rejections are logged with the `kid` and the validation error.

## Capability Checks

Boolean checks for what the active vault can do, evaluated against key operations and `use` flags:

```typescript
amphora.canEncrypt();
amphora.canDecrypt();
amphora.canSign();
amphora.canVerify();
```

| Method         | Returns true when the vault contains an active key with…                      |
| -------------- | ----------------------------------------------------------------------------- |
| `canEncrypt()` | operations including `encrypt`, `deriveKey`, or `wrapKey`, or `use: "enc"`.   |
| `canDecrypt()` | operations including `decrypt`, `deriveKey`, or `unwrapKey`, or `use: "enc"`. |
| `canSign()`    | operations including `sign`, or `use: "sig"`.                                 |
| `canVerify()`  | operations including `verify`, or `use: "sig"`.                               |

## Properties

```typescript
amphora.domain; // string | null
amphora.vault; // Array<IKryptos>
amphora.config; // Array<AmphoraConfig>
amphora.jwks; // AmphoraJwks — throws AmphoraError when no domain is configured
```

`vault`, `config`, and `jwks.keys` getters return shallow copies, so mutating the returned arrays does not affect internal state.

## Errors

All errors thrown by Amphora are instances of `AmphoraError`, which extends `LindormError` from `@lindorm/errors`.

```typescript
import { AmphoraError } from "@lindorm/amphora";

try {
  await amphora.find({ id: "nonexistent" });
} catch (error) {
  if (error instanceof AmphoraError) {
    // error.debug carries structured context, e.g. { queryKeys, totalKeys, activeKeys }
  }
}
```

Common scenarios that throw:

- Constructing with a `domain` that is not a valid URL.
- `add()` called with a key missing `id`, missing `issuer` (when no `domain` is configured), or already expired.
- `findSync()` / `filterSync()` / `findByIdSync()` invoked before `setup()` when external providers are configured.
- Reading `amphora.jwks` when no `domain` is configured.
- `find()` / `findById()` not finding a match after a refresh.
- All configured external config providers or all JWKS providers failing during a refresh.
- Every fetched key being rejected (issuer mismatch, expired, or trust validation failure).

## Testing With Mocks

Mock factories ship at subpath exports — pick the one that matches your test runner.

```typescript
// Vitest
import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";

const amphora = createMockAmphora();
```

```typescript
// Jest
import { createMockAmphora } from "@lindorm/amphora/mocks/jest";

const amphora = createMockAmphora();
```

The returned object implements `IAmphora`. Each method is a spy from the corresponding test framework (`vi.fn()` / `jest.fn()`). Default return values: `find`, `findById`, `findSync`, and `findByIdSync` resolve to / return the string `"mock_kryptos"`; `filter` resolves to `[]`; `filterSync` returns `[]`; `setup` and `refresh` resolve to `undefined`; `canEncrypt`, `canDecrypt`, `canSign`, and `canVerify` return `true`. Override individual methods with the standard mock APIs (`mockReturnValue`, `mockResolvedValueOnce`, etc.).

## API Reference

### `class Amphora`

`new Amphora(options: AmphoraOptions)` — see [Constructor](#constructor).

**Methods**

| Signature                                                   | Description                                                                         |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `add(kryptos: IKryptos \| Array<IKryptos>): void`           | Add one or more keys to the vault.                                                  |
| `env(keys: string \| Array<string>): void`                  | Decode `kryptos:` strings and add them.                                             |
| `setup(): Promise<void>`                                    | Resolve external configuration and load external JWKS. Idempotent and deduplicated. |
| `refresh(): Promise<void>`                                  | Re-fetch external configuration and JWKS. Deduplicated.                             |
| `find(query: AmphoraPredicate): Promise<IKryptos>`          | First match, refreshing external keys when needed. Throws if not found.             |
| `findSync(query: AmphoraPredicate): IKryptos`               | First match against the local vault. Throws if not found.                           |
| `findById(id: string): Promise<IKryptos>`                   | Lookup by id, refreshing if external providers are configured.                      |
| `findByIdSync(id: string): IKryptos`                        | Lookup by id against the local vault only.                                          |
| `filter(query: AmphoraPredicate): Promise<Array<IKryptos>>` | All matches, refreshing when needed.                                                |
| `filterSync(query: AmphoraPredicate): Array<IKryptos>`      | All matches against the local vault.                                                |
| `canEncrypt(): boolean`                                     | Has any active key suitable for encryption.                                         |
| `canDecrypt(): boolean`                                     | Has any active key suitable for decryption.                                         |
| `canSign(): boolean`                                        | Has any active key suitable for signing.                                            |
| `canVerify(): boolean`                                      | Has any active key suitable for verification.                                       |

**Getters**

| Property | Type                                             |
| -------- | ------------------------------------------------ |
| `domain` | `string \| null`                                 |
| `vault`  | `Array<IKryptos>`                                |
| `config` | `Array<AmphoraConfig>`                           |
| `jwks`   | `AmphoraJwks` (throws when no domain configured) |

### `class AmphoraError extends LindormError`

Thrown for every failure surfaced by `Amphora`. Carries structured context on `error.debug`.

### `interface IAmphora`

Public interface implemented by `Amphora` and the mock factories.

### Types

```typescript
import type {
  AmphoraConfig,
  AmphoraExternalOption,
  AmphoraJwks,
  AmphoraOptions,
  AmphoraPredicate,
  AmphoraQuery,
  IAmphora,
} from "@lindorm/amphora";
```

## License

AGPL-3.0-or-later
