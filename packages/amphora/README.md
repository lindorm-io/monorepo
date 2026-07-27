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
  idp: { issuer: "https://accounts.google.com" },
  external: [{ issuer: "https://partner.example.com/" }],
  maxExternalKeys: 100,
  maxIssuers: 1000,
  refreshInterval: 300_000,
});
```

| Option            | Type                             | Default     | Description                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | -------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logger`          | `ILogger`                        | required    | Logger instance from `@lindorm/logger`.                                                                                                                                                                                                                                                                                                      |
| `domain`          | `string`                         | `null`      | The server's domain. Used as the default `issuer` and `jwksUri` for added keys, and as the filter for which keys appear in `amphora.jwks`. Validated as a URL at construction time.                                                                                                                                                          |
| `environment`     | `Environment`                    | `null`      | Cross-environment guard. When set, a key whose leaf certificate declares a different `Environment` OU is rejected on `add`. See [Environment enforcement](#environment-enforcement).                                                                                                                                                         |
| `idp`             | `AmphoraExternalSettings`        | `undefined` | The single UPSTREAM identity provider — a distinguished singleton external issuer. Managed through [`amphora.idp`](#external-providers).                                                                                                                                                                                                     |
| `external`        | `Array<AmphoraExternalSettings>` | `[]`        | Foreign OIDC issuers to discover keys from. Managed through [`amphora.external`](#external-providers).                                                                                                                                                                                                                                       |
| `lookup`          | `ConduitLookup`                  | `undefined` | DNS resolver hook for external discovery/JWKS fetches (SSRF IP-pinning). Supply a resolver that validates each resolved address against an egress policy and returns the vetted IP, so the fetch connects to exactly that address. Omit for ordinary DNS.                                                                                    |
| `maxExternalKeys` | `number`                         | `100`       | Maximum number of keys accepted per external provider; excess keys are truncated.                                                                                                                                                                                                                                                            |
| `maxIssuers`      | `number`                         | `1000`      | Hard cap on the number of external issuers held at once (the `idp` is exempt). Registering past the cap via `external.addIssuer` evicts the least-recently-used external issuer inline; eviction is correctness-safe (it re-fetches on next use). Bounds the vault against client-driven growth (e.g. one issuer per DCR `jwks_uri` client). |
| `maxRedirects`    | `number`                         | `0`         | Max HTTP redirects followed on external fetches. Defaults to `0` — a discovery/JWKS endpoint has no reason to redirect, and following one can defeat a caller's egress guard. Raise only for a provider trusted to redirect.                                                                                                                 |
| `refreshInterval` | `number`                         | `300_000`   | Milliseconds before externally-fetched keys are considered stale.                                                                                                                                                                                                                                                                            |

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

`Amphora.env()` accepts compact `kryptos:`-prefixed strings (the format produced by `KryptosKit.env.import` / `export`) and adds them to the vault. Env-provided keys are the service's **own** keys (`internal: true`) — they are served in the JWKS when public and `publish: true`. Publication is opt-in (`publish` defaults to `false` in kryptos), so a key that belongs in the JWKS must be generated with `publish: true`, while an operational key like a KEK simply takes the default. A key whose `issuer` differs from the Amphora domain logs a warning (it would never be served).

```typescript
amphora.env(process.env.SIGNING_KEY!);
amphora.env([process.env.SIGNING_KEY!, process.env.ENCRYPTION_KEY!]);
```

### Environment enforcement

When Amphora is constructed with an `environment`, `add` (and therefore `env`) rejects any key whose **leaf certificate** declares a different deployment environment — a `development` service refuses a `production` key and vice versa. The environment is read from the certificate subject's OU (organizationalUnitName), which `@lindorm/kryptos` stamps from the certificate `environment` option.

```typescript
const amphora = new Amphora({
  domain: "https://auth.example.com",
  environment: "production",
  logger,
});

amphora.env(process.env.SIGNING_KEY!); // throws environment_mismatch if the cert is not production
```

The guard is deliberately narrow: keys **without a certificate** (an oct KEK, a JWK with no `x5c`), or whose leaf OU is absent or a **foreign** (non-`Environment`) value, are unrestricted. An Amphora without an `environment` ignores certificate environments entirely.

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

await amphora.filter({ use: "enc", hasPrivateKey: true });
```

### Internal keys are excluded by default

Every query — `find`, `findSync`, `filter`, `filterSync`, and the [capability checks](#capability-checks) — defaults to `{ publish: true }`. A key generated with `publish: false` (a KEK, a CA, a cookie or session key) is hidden from **selection**, not merely from publication: it is never handed to a caller who did not ask for one, so a service cannot accidentally sign a token with a key that is absent from its JWKS and therefore unverifiable.

The caller's key wins, so an internal key is an explicit opt-in:

```typescript
await amphora.filter({ use: "sig" }); // published keys only — the default
await amphora.filter({ use: "sig", publish: false }); // internal keys only
await amphora.filter({ use: "sig", publish: { $exists: true } }); // both
```

`findById()` / `findByIdSync()` are **not** filtered: an explicit id is explicit intent, and a token signed by an internal (or since-expired) key must still be verifiable. Key ids are unique **per issuer**, so an id can collide across issuers — `findById` then returns the **most recent** (by `createdAt`) and logs a `warn`, never throwing or picking arbitrarily. Resolve a `kid` off a token with `find({ id, issuer })` to name the issuer and avoid the ambiguity.

> ⚠ **`find({ id })` is NOT `findById(id)`.** They read as interchangeable and are not. `find()` goes through the filter, so `find({ id })` will **not** return an internal (`publish: false`) or inactive key — you get a not-found error for a key that is plainly sitting in the vault. `findById()` bypasses the filter entirely. **Resolving a key from a `kid` you read off a token? Use `findById()`.**

Available query fields (from `AmphoraQuery`):

| Field                   | Type                              | Description                                                                                                                                                                    |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                    | `string`                          | Key id.                                                                                                                                                                        |
| `algClass`              | `"asymmetric" \| "symmetric"`     | Derived from the key type (`oct` ⇔ symmetric). Prefer it over `type: { $nin: ["oct"] }` — that list rots the day a sixth key type lands.                                       |
| `algorithm`             | `string`                          | JOSE algorithm (e.g. `ES512`, `RS256`, `EdDSA`).                                                                                                                               |
| `certificateThumbprint` | `string`                          | SHA-256 thumbprint of the leaf certificate.                                                                                                                                    |
| `curve`                 | `string`                          | EC/OKP curve (e.g. `P-256`, `Ed25519`, `X25519`).                                                                                                                              |
| `encryption`            | `string`                          | Content encryption algorithm (e.g. `A256GCM`).                                                                                                                                 |
| `hasPrivateKey`         | `boolean`                         | Whether the key contains private material.                                                                                                                                     |
| `hasPublicKey`          | `boolean`                         | Whether the key contains public material.                                                                                                                                      |
| `internal`              | `boolean`                         | Whether the key is our own. `false` means it was imported from an external provider (a remote JWKS).                                                                           |
| `issuer`                | `string`                          | Issuing authority URL.                                                                                                                                                         |
| `operations`            | `Array<KeyOperation>`             | Derived capability of the key material (`sign`, `verify`, `encrypt`, `decrypt`, `deriveKey`, `deriveBits`, `wrapKey`, `unwrapKey`) — advisory; prefer `use` + `hasPrivateKey`. |
| `ownerId`               | `string`                          | Tenant/owner identifier.                                                                                                                                                       |
| `publish`               | `boolean`                         | Whether the key belongs in the published JWKS. **Defaults to `true` in every query** — pass it explicitly to reach internal keys.                                              |
| `purpose`               | `string`                          | Caller-defined key purpose.                                                                                                                                                    |
| `type`                  | `"EC" \| "RSA" \| "oct" \| "OKP"` | Key type.                                                                                                                                                                      |
| `use`                   | `"sig" \| "enc"`                  | Signature or encryption.                                                                                                                                                       |

All query results are filtered to active keys only (excludes expired and not-yet-valid keys), default to published keys only, and are sorted newest-first by creation date.

## JWKS Endpoint

When `domain` is set, `amphora.jwks` returns the public JWKS for keys that match the configured domain. External keys, `publish: false` keys, expired keys, and keys without public material are excluded. Accessing `jwks` without a configured `domain` throws `AmphoraError`.

```typescript
app.get("/.well-known/jwks.json", (req, res) => {
  res.json(amphora.jwks);
});
```

The `jwks` getter returns `{ keys: Array<LindormJwk> }`. Keys are sorted newest-first by creation date. Not-yet-active keys (with a future `notBefore`) are included so consumers can pre-cache them; expired keys are excluded.

## External Providers

Keys are partitioned by **provenance**, not by keyspace — one vault, three scopes:

- **internal** — keys this service mints (`add` / `env`). `internal: true`, served in `jwks`.
- **external** — foreign issuers' keys, fetched from their JWKS (`amphora.external`). `internal: false`.
- **idp** — the ONE upstream identity provider (`amphora.idp`), a distinguished singleton external issuer.

**Finding stays unified.** `find` / `findById` / `filter` search every key regardless of provenance — the scopes govern only how keys ENTER and REFRESH, never how they are found.

### `amphora.external` — foreign issuers

```typescript
await amphora.external.addIssuer({ issuer: "https://partner.example.com/" });
amphora.external.issuers(); // Array<AmphoraExternalConfig> — resolved + enriched state
await amphora.external.refresh("https://partner.example.com/"); // refetch one issuer
amphora.external.removeIssuer("https://partner.example.com/"); // drop source + evict its keys

amphora.external.add(foreignKryptos); // insert a foreign KEY (⇒ internal:false)
amphora.external.remove(kid);
```

An issuer source takes one of three forms (also acceptable in the `external` / `idp` constructor options):

```typescript
// 1. Issuer URL only — discovers via {issuer}/.well-known/openid-configuration
{ issuer: "https://accounts.google.com" }

// 2. Issuer + JWKS URI directly — skips OpenID discovery. The issuer may be a URN.
{ issuer: "https://partner-api.com/", jwksUri: "https://partner-api.com/.well-known/jwks.json" }

// 3. Explicit OpenID configuration URI
{ openIdConfigurationUri: "https://login.microsoftonline.com/v2.0/.well-known/openid-configuration" }
```

Each source also accepts:

| Field                 | Type                           | Description                                                                                                                                   |
| --------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `load`                | `boolean`                      | Eager-fetch this issuer's keys on `addIssuer` / `idp.set` (default `false` — lazy; fetched on the next refresh or a find-miss on its issuer). |
| `openIdConfiguration` | `Partial<OpenIdConfiguration>` | Override or supplement values from the discovery document.                                                                                    |
| `trustAnchors`        | `string \| Array<string>`      | PEM-encoded CA certificate(s) used to validate the certificate chains attached to fetched JWKs. See [Trust Anchors](#trust-anchors).          |
| `trustMode`           | `"strict" \| "lax"`            | How to handle fetched keys without a certificate chain when `trustAnchors` is set. Default `"strict"`.                                        |

**An external issuer must be a URI** — a URL with an authority (`https://…`) or a URN (`urn:…`). A bare identifier throws `external_issuer_not_uri`; a URN has no authority to discover from, so a URN issuer with no explicit `jwksUri` throws `urn_issuer_requires_jwks_uri`.

`external.issuers()` returns the resolved config per issuer: `input` (the declared options, verbatim), the settled `issuer` / `jwksUri`, the nested `openIdConfiguration` discovery doc, plus `keyCount`, `lastRefresh` (last fetch), and `lastAccess` (last find/filter hit — the LRU signal for `maxIssuers` eviction; `null` until first use).

### `amphora.idp` — the upstream identity provider

The idp is a singleton external issuer with a management + config view over the same fetch machinery:

```typescript
await amphora.idp.set({ issuer: "https://accounts.google.com" }); // register or REPLACE (a swap evicts the old idp's keys)
amphora.idp.config(); // AmphoraExternalConfig — throws `idp_not_configured` when unset
await amphora.idp.refresh();
amphora.idp.clear();
```

An issuer belongs to exactly **one** scope — the idp or `external`, never both. Registering the same issuer in both throws `issuer_scope_conflict`.

### Refresh behaviour

- `setup()` is lazy — the first `find()` or `filter()` call triggers it automatically when external / idp sources are configured. `findSync()` / `filterSync()` / `findByIdSync()` throw if invoked beforehand.
- Concurrent calls to `setup()` or `refresh()` are deduplicated; only one network round-trip is in flight at a time.
- Refresh is per-issuer. `amphora.refresh()` refetches the idp AND all external issuers; `amphora.external.refresh(issuer)` and `amphora.idp.refresh()` target one. A find-miss on `find({ id, issuer })` refetches that one issuer; a `findById(id)` miss (no issuer) refetches everything.
- After setup, async lookups re-fetch when the queried issuer's cache is older than `refreshInterval`. If the local vault already satisfies the query and the cache is fresh, no network call is made.
- Partial failures are tolerated: if some issuers fail but at least one succeeds, the vault is updated with what's available. If every configured issuer fails, refresh throws `AmphoraError`.
- Fetched keys whose `iss` claim does not match the configured `issuer` are rejected to prevent issuer spoofing.
- Rejection is per key, never per issuer: a JWK that cannot be parsed (e.g. one without an `alg`, which `@lindorm/kryptos` requires) is logged with its `kid` and skipped — the issuer's remaining keys still load. Only when _no_ key survives does the refresh throw.

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

Boolean checks for what the active vault can do. Each asks whether the vault holds the key **half** the operation needs — not what a key's `key_ops` advertises:

```typescript
amphora.canEncrypt();
amphora.canDecrypt();
amphora.canSign();
amphora.canVerify();
```

| Method         | Returns true when the vault contains an active, published key matching… |
| -------------- | ----------------------------------------------------------------------- |
| `canEncrypt()` | `{ use: "enc" }` — a public half or an oct secret.                      |
| `canDecrypt()` | `{ use: "enc", hasPrivateKey: true }`                                   |
| `canSign()`    | `{ use: "sig", hasPrivateKey: true }`                                   |
| `canVerify()`  | `{ use: "sig" }`                                                        |

`hasPrivateKey` is what excludes remotely-fetched keys: a JWKS only ever yields public halves, so a vault holding nothing but external sig keys can verify but not sign.

Like every other query, the capability checks run against the **published** set — a vault holding nothing but internal (`publish: false`) keys reports no capabilities, because those keys are not candidates for selection.

## Properties

```typescript
amphora.domain; // string | null
amphora.vault; // Array<IKryptos>
amphora.config; // Array<AmphoraInternalConfig> — the service's OWN identity, derived from domain
amphora.jwks; // AmphoraJwks — throws AmphoraError when no domain is configured
amphora.external; // IAmphoraExternal — foreign issuers
amphora.idp; // IAmphoraIdp — the upstream identity provider
```

`config` is the service's own identity — `{ issuer, jwksUri }` derived from `domain` (empty when no domain is set). External issuer configs live on `external.issuers()` and `idp.config()`. `vault`, `config`, `external.issuers()`, and `jwks.keys` getters return copies, so mutating the returned arrays does not affect internal state.

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
- An external issuer that is not a URI (`external_issuer_not_uri`), or a URN issuer with no `jwksUri` (`urn_issuer_requires_jwks_uri`) — validated at registration, so a lazy source is rejected up front.
- A discovery document that provides no `issuer` with none configured (`external_issuer_unresolved`) — a resolved external issuer must be a URI.
- Registering an issuer that already belongs to the other scope (`issuer_scope_conflict`) — an issuer is the idp **or** an external provider, never both — or `removeIssuer()` called with the idp's issuer (`remove_issuer_is_idp`; use `idp.clear()`).
- `idp.config()` called before an idp is set (`idp_not_configured`).
- All configured external config providers or all JWKS providers failing during a refresh.
- Every fetched key being rejected (issuer mismatch, expired, unparseable, or trust validation failure).

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

The returned object implements `IAmphora`, including the `external` and `idp` facets — every method on those is a spy too (`external.issuers()` returns `[]`, `idp.config()` returns a stub config). Each method is a spy from the corresponding test framework (`vi.fn()` / `jest.fn()`). Default return values: `find`, `findById`, `findSync`, and `findByIdSync` resolve to / return the string `"mock_kryptos"`; `filter` resolves to `[]`; `filterSync` returns `[]`; `setup` and `refresh` resolve to `undefined`; `canEncrypt`, `canDecrypt`, `canSign`, and `canVerify` return `true`. Override individual methods with the standard mock APIs (`mockReturnValue`, `mockResolvedValueOnce`, etc.).

## API Reference

### `class Amphora`

`new Amphora(options: AmphoraSettings)` — see [Constructor](#constructor).

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

| Property   | Type                                             |
| ---------- | ------------------------------------------------ |
| `domain`   | `string \| null`                                 |
| `vault`    | `Array<IKryptos>`                                |
| `config`   | `Array<AmphoraInternalConfig>`                   |
| `jwks`     | `AmphoraJwks` (throws when no domain configured) |
| `external` | `IAmphoraExternal`                               |
| `idp`      | `IAmphoraIdp`                                    |

### `interface IAmphoraExternal` (`amphora.external`)

| Signature                                                   | Description                                           |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| `add(kryptos: IKryptos \| Array<IKryptos>): void`           | Insert one or more foreign keys (⇒ `internal:false`). |
| `remove(id: string): void`                                  | Drop a key by id.                                     |
| `addIssuer(source: AmphoraExternalSettings): Promise<void>` | Register an issuer source (eager when `load`).        |
| `removeIssuer(issuer: string): void`                        | Drop the source and evict its keys.                   |
| `issuers(): Array<AmphoraExternalConfig>`                   | The resolved + enriched config per issuer.            |
| `refresh(issuer: string): Promise<void>`                    | Refetch one issuer.                                   |

### `interface IAmphoraIdp` (`amphora.idp`)

| Signature                                             | Description                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| `set(source: AmphoraExternalSettings): Promise<void>` | Register or REPLACE the upstream (a swap evicts old keys).    |
| `config(): AmphoraExternalConfig`                     | The resolved config — throws `idp_not_configured` when unset. |
| `refresh(): Promise<void>`                            | Refetch the upstream.                                         |
| `clear(): void`                                       | Unset the idp and evict its keys.                             |

### `class AmphoraError extends LindormError`

Thrown for every failure surfaced by `Amphora`. Carries structured context on `error.debug`.

### `interface IAmphora`

Public interface implemented by `Amphora` and the mock factories.

### Types

```typescript
import type {
  AmphoraExternalConfig,
  AmphoraExternalSettings,
  AmphoraInternalConfig,
  AmphoraJwks,
  AmphoraSettings,
  AmphoraPredicate,
  AmphoraQuery,
  IAmphora,
  IAmphoraExternal,
  IAmphoraIdp,
} from "@lindorm/amphora";
```

## License

AGPL-3.0-or-later
