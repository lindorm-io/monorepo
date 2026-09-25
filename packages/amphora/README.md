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
  internal: { issuer: "https://auth.example.com" },
  logger: createLogger(),
});

const key = KryptosKit.generate.sig.ec({ algorithm: "ES512", publish: true });
amphora.add(key);

const found = await amphora.find({ use: "sig" });
```

`publish` is opt-in — kryptos defaults it to `false`, and amphora does not hand back one of our own unpublished keys unless a query asks for one. A token key needs `publish: true`; an operational key like a KEK takes the default. See [our own unpublished keys are excluded by default](#our-own-unpublished-keys-are-excluded-by-default).

## Constructor

```typescript
new Amphora({
  internal: { issuer: "https://auth.example.com" },
  logger,
  idp: { issuer: "https://accounts.google.com" },
  external: [{ issuer: "https://partner.example.com/", required: true }],
  maxExternalKeys: 100,
  maxIssuers: 1000,
  refreshInterval: 300_000,
  timeout: 10_000,
});
```

The three issuer scopes are named the same way in the settings as on the instance — `internal`, `idp`, `external` — so what you set is what you read back.

| Option            | Type                             | Default     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | -------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logger`          | `ILogger`                        | required    | Logger instance from `@lindorm/logger`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `internal`        | `AmphoraInternalSettings`        | `undefined` | This service's OWN issuer scope — `{ issuer }`, the URI it mints tokens under. Used as the default `issuer` and `jwksUri` for added keys, as the filter for which keys appear in `amphora.jwks`, and as the source of `amphora.internal`. Validated as a URI at construction time (`internal_issuer_not_uri`) — see [an issuer is a URI, inside and out](#an-issuer-is-a-uri-inside-and-out). The BLOCK is optional — omit it for a service that only verifies — but `issuer` inside it is required: a block that declares nothing is not a thing anyone means. |
| `environment`     | `Environment`                    | `null`      | Cross-environment guard. When set, a key whose leaf certificate declares a different `Environment` OU is rejected on `add`. See [Environment enforcement](#environment-enforcement).                                                                                                                                                                                                                                                                                                                                                                            |
| `idp`             | `AmphoraIdpSettings`             | `undefined` | The single UPSTREAM identity provider — a distinguished singleton external issuer. ALWAYS REQUIRED: `setup()` fetches it and THROWS when it cannot be resolved. `AmphoraIdpSettings` is `AmphoraExternalSettings` without `required` — there is no deployment in which a missing upstream is survivable, so there is nothing to declare. Managed through [`amphora.idp`](#external-providers).                                                                                                                                                                  |
| `external`        | `Array<AmphoraExternalSettings>` | `[]`        | Foreign OIDC issuers to discover keys from. All of them are fetched at `setup()`; set `required: true` on the ones whose failure should stop the boot. Managed through [`amphora.external`](#external-providers).                                                                                                                                                                                                                                                                                                                                               |
| `lookup`          | `ConduitLookup`                  | `undefined` | DNS resolver hook for external discovery/JWKS fetches (SSRF IP-pinning). Supply a resolver that validates each resolved address against an egress policy and returns the vetted IP, so the fetch connects to exactly that address. Omit for ordinary DNS.                                                                                                                                                                                                                                                                                                       |
| `maxExternalKeys` | `number`                         | `100`       | Maximum number of keys accepted per external provider; excess keys are truncated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `maxIssuers`      | `number`                         | `1000`      | Hard cap on the number of external issuers held at once (the `idp` is exempt). Registering past the cap via `external.addIssuer` evicts the least-recently-used external issuer inline. Bounds the vault against client-driven growth (e.g. one issuer per DCR `jwks_uri` client). **Eviction does not self-heal** — re-registering an evicted issuer is the consumer's job, see [eviction is final](#eviction-is-final).                                                                                                                                       |
| `maxRedirects`    | `number`                         | `0`         | Max HTTP redirects followed on external fetches. Defaults to `0` — a discovery/JWKS endpoint has no reason to redirect, and following one can defeat a caller's egress guard. Raise only for a provider trusted to redirect.                                                                                                                                                                                                                                                                                                                                    |
| `refreshInterval` | `number`                         | `300_000`   | Milliseconds before externally-fetched keys are considered stale. It is also the retry floor after a failed load — see [retry and backoff](#retry-and-backoff).                                                                                                                                                                                                                                                                                                                                                                                                 |
| `timeout`         | `number`                         | `10000`     | Per-fetch HTTP timeout for external discovery/JWKS fetches. It bounds ONE attempt and the fetch retries up to three times, so one load is worst-case roughly three times this plus backoff. `external.addIssuer` fetches INLINE, so on a service that registers issuers per request this sits in the request's wall clock — lower it there.                                                                                                                                                                                                                     |

### An issuer is a URI, inside and out

Every issuer amphora holds — this service's own, the upstream `idp`, any external
peer — must be a **URI**: a URL with an authority (`https://auth.example.com`) or a
URN (`urn:example:auth`). One rule, one shape, three scopes. An opaque
`scheme:value` such as `foo:bar` is neither and is rejected at construction
(`internal_issuer_not_uri`) or at registration (`external_issuer_not_uri`).

The rule is not cosmetic. Key resolution narrows a `kid` lookup to the issuer that
owns it, and that narrowing applies **only when the issuer is a URI** — key names
are unique per issuer, so an issuer that cannot be matched cannot scope: its own
tokens' keys would resolve across every registered issuer at once.

### An address is an http(s) URL

Being a legal issuer and being somewhere amphora can fetch from are two different
things, so they are two different rules. **Anything amphora derives a location from
or requests over the wire must be an `http:` / `https:` URL with a host** — the
issuer it discovers from, `jwksUri`, and `openIdConfigurationUri`. A URN has no
authority to resolve a path against, and any other scheme with one (`ftp://…`)
resolves into a syntactically valid address nothing can fetch; deriving that is
worse than deriving nothing.

So an issuer that is not an http(s) URL derives no JWKS location:
`amphora.internal.jwksUri` is `null` and keys added under it carry no `jwksUri`. On
the external side it must be handed one explicitly, or registration throws
`non_http_issuer_requires_jwks_uri`. Such an issuer is still perfectly valid as an
IDENTITY — `{ issuer: "urn:example:auth", jwksUri: "https://…" }` names a key set
and says where to get it, which is the shape a private-use issuer uses.

A declared `jwksUri` or `openIdConfigurationUri` that is not an http(s) URL is
refused at registration (`external_jwks_uri_not_http_url`,
`external_openid_configuration_uri_not_http_url`) rather than carried as far as the
request, or quietly ignored.

## Adding Keys

### From `IKryptos` instances

```typescript
const sigKey = KryptosKit.generate.sig.ec({ algorithm: "ES512", publish: true });
const encKey = KryptosKit.generate.enc.okp({
  algorithm: "ECDH-ES",
  curve: "X25519",
  publish: true,
});

amphora.add(sigKey);
amphora.add([sigKey, encKey]);
```

When `internal.issuer` is set, Amphora auto-assigns `issuer` and `jwksUri` to added keys that don't already have them. Keys without an `id`, without an `issuer` (when the Amphora declares none), or that are already expired are rejected with `AmphoraError`.

**Keys are deduplicated by `(id, issuer)`, not by `id` alone** — adding a key replaces the key with the same id _under the same issuer_, and touches nothing else. A key id is unique only PER ISSUER (which is why an unscoped [`findById` collision throws](#finding-keys)), so two peers may legitimately publish the same `kid`; a bare-id rule would let one `add` of our own key delete both of theirs.

**A write never crosses provenance.** That `(id, issuer)` slot belongs either to us (`internal: true`) or to a foreign issuer, and the facet that owns it is the only one that may write it: `add()` / `env()` over a slot holding a FOREIGN key throws `kryptos_provenance_conflict` and changes nothing, exactly as [`external.add` / `external.remove`](#amphoraexternal--foreign-issuers) do over one of ours. The rule keys on the `internal` flag, never on the issuer — a foreign key may legitimately carry our own issuer, so the issuer alone does not make it ours. Throwing beats the alternatives: skipping would make a failed write indistinguishable from a successful one, and letting both keys sit in the one slot would make every later `findById(id, issuer)` throw `kryptos_ambiguous_id` instead — punishing a read that did nothing wrong.

### From environment-encoded strings

`Amphora.env()` accepts compact `kryptos:`-prefixed strings (the format produced by `KryptosKit.env.import` / `export`) and adds them to the vault. Env-provided keys are the service's **own** keys (`internal: true`) — they are served in the JWKS when public and `publish: true`. Publication is opt-in (`publish` defaults to `false` in kryptos), so a key that belongs in the JWKS must be generated with `publish: true`, while an operational key like a KEK simply takes the default. A key whose `issuer` differs from the Amphora's own `issuer` logs a warning (it would never be served).

```typescript
amphora.env(process.env.SIGNING_KEY!);
amphora.env([process.env.SIGNING_KEY!, process.env.ENCRYPTION_KEY!]);
```

### Environment enforcement

When Amphora is constructed with an `environment`, `add` (and therefore `env`) rejects any key whose **leaf certificate** declares a different deployment environment — a `development` service refuses a `production` key and vice versa. The environment is read from the certificate subject's OU (organizationalUnitName), which `@lindorm/kryptos` stamps from the certificate `environment` option.

```typescript
const amphora = new Amphora({
  internal: { issuer: "https://auth.example.com" },
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

// A kid is unique only per issuer — name the issuer whenever you know it.
const scoped = await amphora.findById("some-uuid", "https://partner.example.com/");
```

`find()` and `findById()` throw `AmphoraError` when no match is found — but when the re-fetch that would have found it FAILED, they throw that failure instead, so an unreachable provider reads as an unreachable provider (see [a failed re-fetch does not deny a cached answer](#a-failed-re-fetch-does-not-deny-a-cached-answer)). A scoped `findById` refreshes **only** the named issuer; an unscoped one has nothing to target and falls back to the declared sweep — which does not reach an issuer added through `addIssuer`, so name the issuer when the key belongs to one (see [declared and registered issuers](#declared-and-registered-issuers-refresh-differently)).

### Sync — local vault only

The sync methods never make network calls. If external providers are configured, `setup()` must have completed first or the call throws.

```typescript
const key = amphora.findSync({ id: "some-uuid" });
const byId = amphora.findByIdSync("some-uuid");
const scoped = amphora.findByIdSync("some-uuid", "https://partner.example.com/");
const keys = amphora.filterSync({ use: "enc" });
```

### Query format

Queries are conditions over key attributes. Plain values are equality checks; MongoDB-style operators are supported for richer filters via `@lindorm/utils`.

```typescript
await amphora.filter({ use: "sig", type: "EC" });

await amphora.filter({ algorithm: { $in: ["ES256", "ES384", "ES512"] } });

await amphora.filter({ use: "enc", hasPrivateKey: true });
```

### Our own unpublished keys are excluded by default

Every query — `find`, `findSync`, `filter`, `filterSync` — drops keys that are both ours (`internal: true`) and unpublished (`publish: false`): a KEK, a CA, a cookie or session key. Such a key is hidden from **selection**, not merely from publication — it is never handed to a caller who did not ask for one, so a service cannot accidentally sign a token with a key that is absent from its JWKS and therefore unverifiable.

The gate reads `publish` only for our own keys, because that is all `publish` means — "belongs in OUR published JWKS". A foreign key never does, so external keys pass the gate whatever their own flag says.

The gate is on **selection**, so `findById()` / `findByIdSync()` and the [capability checks](#capability-checks) are outside it: an explicit id is explicit intent, and a capability is not a pick.

**Naming `publish` in the query turns the gate off** and leaves the value as an ordinary match, so reaching an unpublished key is an explicit opt-in:

```typescript
await amphora.filter({ use: "sig" }); // gated: our published keys, plus every external key
await amphora.filter({ use: "sig", publish: false }); // ungated: unpublished keys only
await amphora.filter({ use: "sig", publish: { $exists: true } }); // ungated: everything (publish is always set)
```

⚠ **"Naming it" means giving it a value — `undefined` is not one.** Across the toolkit an `undefined` condition value means _not specified_ and constrains nothing, so `{ publish: undefined }` is the same query as `{}` and gets the **gate**, not the opt-out. Amphora strips such keys from every condition at its public boundary, which is what makes the two spellings identical rather than merely similar:

```typescript
await amphora.filter({ use: "sig", publish: cfg.publish }); // cfg.publish unset ⇒ gated, exactly as { use: "sig" }
```

Pass the value you mean. A consumer that wants the caller to be able to _opt out_ of the gate has to spell the opt-out itself (`condition.publish ?? false`, or omitting `publish` from its own selector type) — an unset config field can never reach past the gate by accident.

**An operation nobody else reads opts out once, centrally.** When the artifact never leaves this deployment — a proteus `@Encrypted` column, an iris message, a pylon cookie value or cookie signature — the key that made it is ours in the strict sense: it never belongs in a JWKS, because no relying party will ever check it. A selector for such a key that names no `publish` means `publish: false`. That is the exported `UNPUBLISHED_DEFAULT`, applied as the layer under the caller's own condition:

```typescript
import {
  applyKeyFloor,
  ENVELOPE_FLOOR,
  SIGN_FLOOR,
  UNPUBLISHED_DEFAULT,
} from "@lindorm/amphora";

applyKeyFloor(ENVELOPE_FLOOR, UNPUBLISHED_DEFAULT, { purpose: "cookie" });
// → { purpose: "cookie", publish: false, use: "enc", hasPrivateKey: true, isActive: true }

applyKeyFloor(SIGN_FLOOR, UNPUBLISHED_DEFAULT, { purpose: "cookie" });
// → { purpose: "cookie", publish: false, use: "sig", hasPrivateKey: true, isActive: true }
```

A **floor** (`SIGN_FLOOR`, `VERIFY_FLOOR`, `SEAL_FLOOR`, `ENVELOPE_FLOOR`, `DECRYPT_FLOOR`) is spread **last** and can never be overridden — it is the minimum that makes the operation possible. A **default** is spread among the caller layers, so the caller wins: state `publish: true` and you get a published key. Without the default layer a consumer must spell `publish: false` in its own config to reach its own key, and forgetting it silently selects the JWKS token key instead.

⚠ **The default is about `publish`, not about safety — it does not belong everywhere.** A **token** signature exists to be verified against our JWKS, so its key must be published: `@lindorm/aegis` applies the floor and the deployment's own selector and deliberately no default. Nor does it belong on a **check**: where a key is resolved by `kid` through the unfiltered `findById` there is no gate to reach past, and a `publish` layer stops being "where to look" and becomes an assertion that the key is unpublished (pylon's cookie verification is that shape, and gets no default). Sharing `SIGN_FLOOR` with an operation says nothing about sharing this default with it.

`findById()` / `findByIdSync()` are **not** filtered: an explicit id is explicit intent, and a token signed by an internal (or since-expired) key must still be verifiable.

Key ids are unique **per issuer**, so pass the issuer as the second argument whenever you know it — `findById(kid, issuer)`. It **narrows** the lookup to that issuer's keys and there is **no fallback**: an id the named issuer does not hold throws, it never retries unscoped. Falling back would be strictly worse than not scoping at all, since an attacker would then need no id collision — only a `kid` the issuer it claims to be does not hold. A scoped miss also refetches that **one** issuer rather than every registered one.

Called with no issuer, an id that matches keys from **more than one** issuer throws `kryptos_ambiguous_id`, naming them. There is nothing to choose with: `createdAt` comes off the fetched JWK's own `iat`, so a "most recent wins" rule let a registered peer pick its own tiebreak and answer for someone else's `kid`.

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
| `isActive`              | `boolean`                         | Lifetime state — usable now (neither pending nor expired).                                                                                                                     |
| `isExpired`             | `boolean`                         | Lifetime state — past `expiresAt`.                                                                                                                                             |
| `isPending`             | `boolean`                         | Lifetime state — `notBefore` has not passed, so the key cannot yet have produced anything.                                                                                     |
| `issuer`                | `string`                          | Issuing authority URL.                                                                                                                                                         |
| `operations`            | `Array<KeyOperation>`             | Derived capability of the key material (`sign`, `verify`, `encrypt`, `decrypt`, `deriveKey`, `deriveBits`, `wrapKey`, `unwrapKey`) — advisory; prefer `use` + `hasPrivateKey`. |
| `ownerId`               | `string`                          | Tenant/owner identifier.                                                                                                                                                       |
| `publish`               | `boolean`                         | Whether the key belongs in the published JWKS. **Gated by default for our own keys** — name it in the query to turn the gate off.                                              |
| `purpose`               | `string`                          | Caller-defined key purpose.                                                                                                                                                    |
| `type`                  | `"EC" \| "RSA" \| "oct" \| "OKP"` | Key type.                                                                                                                                                                      |
| `use`                   | `"sig" \| "enc"`                  | Signature or encryption.                                                                                                                                                       |

All query results are filtered to active keys only (excludes expired and not-yet-valid keys), pass the default publish gate, and are sorted newest-first by creation date. The [capability checks](#capability-checks) apply the active filter but not the publish gate.

## JWKS Endpoint

When `internal.issuer` is set, `amphora.jwks` returns the public JWKS for keys that match it. External keys, `publish: false` keys, expired keys, and keys without public material are excluded. Accessing `jwks` without a configured `issuer` throws `AmphoraError`.

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
amphora.external.issuers(); // Array<AmphoraExternalConfig> — every source whose issuer has settled
await amphora.external.refresh("https://partner.example.com/"); // refetch one issuer
amphora.external.removeIssuer("https://partner.example.com/"); // drop source + evict its keys

amphora.external.add(foreignKryptos); // insert a foreign KEY (⇒ internal:false)
amphora.external.remove(kid, "https://partner.example.com/"); // drop ONE key: id + issuer
```

`external.add` takes a key that is not ours, so it stamps nothing: the key keeps its own `issuer`, and one **without** an issuer is rejected (`kryptos_issuer_required`). There is no fallback to stamp — the Amphora issuer is ours, and putting it on another party's key would claim that key as ours. Replacement is scoped the same way as [`add`](#from-ikryptos-instances): `(id, issuer)`, so two foreign issuers sharing a `kid` coexist and neither evicts the other.

`external.remove` is scoped the same way, and that is why **`issuer` is required, not optional**: a key id is unique only per issuer, so a bare id names a key at every peer that publishes that `kid` — removing by it would take all of them. It is the same collision `findById` refuses to guess at (`kryptos_ambiguous_id`). Every foreign key carries an issuer, so a caller always has one to name; removing an id the named issuer does not hold is a no-op.

**Both key verbs are foreign-only, and that is enforced.** Naming a `(id, issuer)` slot that holds one of OUR keys throws `kryptos_provenance_conflict` — `external.add` replaces nothing, `external.remove` deletes nothing. It is one rule, symmetric: `amphora.add()` / `amphora.env()` throw the same way over a foreign key ([above](#from-ikryptos-instances)). ⚠ The rule keys on the `internal` flag, **never on the issuer**: `external.add` accepts a foreign key carrying our own issuer — a peer may publish under any `iss` it likes — and such a key is stored, found and removed like any other, as long as its slot is not one of ours.

An issuer source takes one of three forms (also acceptable in the `external` / `idp` constructor options):

```typescript
// 1. Issuer URL only — discovers via {issuer}/.well-known/openid-configuration
{ issuer: "https://accounts.google.com" }

// 2. Issuer + JWKS URI directly — skips OpenID discovery. The issuer may be a URN.
{ issuer: "https://partner-api.com/", jwksUri: "https://partner-api.com/.well-known/jwks.json" }

// 3. Explicit OpenID configuration URI
{ openIdConfigurationUri: "https://login.microsoftonline.com/v2.0/.well-known/openid-configuration" }
```

When a fetched discovery document publishes an `issuer` that differs from the declared one, **the published value wins**, and amphora files that issuer's keys under it. Microsoft needs this — it templates `{tenantid}` in the metadata it serves per tenant. So read the settled issuer off `external.issuers()` / `idp.config()` rather than re-deriving it from what you declared; a separately-derived issuer can name a provider whose keys are filed elsewhere.

Each source also accepts:

| Field                 | Type                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `required`            | `boolean`                      | Whether a failed fetch is FATAL — not WHEN the fetch happens (every DECLARED source is fetched at `setup()`, always). `true` — `setup()` throws when this issuer cannot be resolved or its keys cannot be fetched. `false` (default) — the first failure is a `warn`, setup completes, and the issuer is retried on the backoff below. Refresh is tolerant either way. Meaningful only for a source declared in the constructor: one added through `addIssuer` reports its failure by throwing from that call. |
| `openIdConfiguration` | `Partial<OpenIdConfiguration>` | Override or supplement values from the discovery document.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `trustAnchors`        | `string \| Array<string>`      | PEM-encoded CA certificate(s) used to validate the certificate chains attached to fetched JWKs. See [Trust Anchors](#trust-anchors).                                                                                                                                                                                                                                                                                                                                                                           |
| `trustMode`           | `"strict" \| "lax"`            | How to handle fetched keys without a certificate chain when `trustAnchors` is set. Default `"strict"`.                                                                                                                                                                                                                                                                                                                                                                                                         |

**An external issuer must be a URI** — a URL with an authority (`https://…`) or a URN (`urn:…`), the same rule the internal issuer answers to (see [an issuer is a URI, inside and out](#an-issuer-is-a-uri-inside-and-out)). A bare or opaque identifier throws `external_issuer_not_uri`. **`jwksUri` and `openIdConfigurationUri` must be `http(s)` URLs** — amphora fetches them (see [an address is an http(s) URL](#an-address-is-an-https-url)) — and an issuer that is not itself an http(s) URL names no location to discover from, so it requires an explicit `jwksUri` (`non_http_issuer_requires_jwks_uri`).

`external.issuers()` returns the resolved config per issuer: `input` (the declared options, verbatim), the resolved `required`, the settled `issuer` / `jwksUri`, the nested `openIdConfiguration` discovery doc, plus `keyCount`, `lastRefresh` (last SUCCESSFUL fetch — `null` while every attempt so far has failed), and `lastAccess` (last find/filter hit — the LRU signal for `maxIssuers` eviction; `null` until first use).

`AmphoraExternalConfig.issuer` is a `string`, never `null` — amphora scopes, verifies (`jwk.iss`) and evicts keys BY issuer, so a config without one is not a config. A source registered by `openIdConfigurationUri` alone carries no issuer until that document is fetched — before `setup()`, or after it when a non-`required` fetch failed — so it is simply **omitted** from `issuers()` until it resolves rather than listed with a `null`. It stays registered and appears the moment it resolves; one unreachable peer never takes out the whole listing. `jwksUri` DOES stay `string | null` — an issuer's keys can be handed over directly with `external.add(kryptos)`, so the fetch is what complains (`external_jwks_uri_missing`), not the listing.

The discovery document is typed `Partial<OpenIdConfiguration>` — `OpenIdConfiguration` from [`@lindorm/openid`](https://www.npmjs.com/package/@lindorm/openid), the one provider-metadata shape the whole toolkit shares, as a partial because amphora neither validates the fetched document nor reads more than `issuer` / `jwksUri`. Every field the provider sends is preserved verbatim for downstream consumers (a relying party reads its endpoints off `idp.config().openIdConfiguration`); a consumer that needs a complete document validates it at its own boundary.

### `amphora.idp` — the upstream identity provider

The idp is a singleton external issuer with a management + config view over the same fetch machinery:

```typescript
await amphora.idp.set({ issuer: "https://accounts.google.com" }); // register or REPLACE (a successful swap evicts the old idp's keys)
amphora.idp.config(); // AmphoraExternalConfig — throws `idp_not_configured` when unset,
// and `idp_issuer_unresolved` when declared by `openIdConfigurationUri` alone and setup() has not run yet
await amphora.idp.refresh();
amphora.idp.clear();
```

An issuer belongs to exactly **one** scope — the idp or `external`, never both. Registering the same issuer in both throws `issuer_scope_conflict`.

**The idp is always required, so it is strict at boot.** `AmphoraIdpSettings` has no `required` flag — a relying party cannot verify a single token from an upstream it could not resolve, so the answer is never `false`. `idp.set()` awaits the discovery / JWKS fetch and throws when it fails, and `amphora.setup()` does the same for an idp declared in the constructor. **A service will not boot until its IdP serves discovery** — deploy ordering follows from that.

**Registration is all-or-nothing.** `idp.set()` and `external.addIssuer()` resolve and fetch the new source BEFORE they touch anything amphora is serving from, so a failure changes nothing:

- A failed `idp.set()` leaves the previous idp exactly as it was — same config, same keys, still serving. You never trade a working upstream for one you could not reach. Re-setting the SAME issuer is safe: the keys are only swapped once the new set is in hand.
- A failed `addIssuer()` registers no source, and does not spend the `maxIssuers` cap — so it never evicts a healthy peer on behalf of one that did not load.

Retry the call; nothing needs unwinding first.

**`addIssuer()` is idempotent by issuer**, sequentially and concurrently. Registering an issuer amphora already holds REPLACES it rather than adding a second entry beside it, and concurrent calls for one issuer share a single in-flight registration and a single fetch. A caller cannot do this itself — a registration flow is check-then-act with an `await` in the middle, so two concurrent first-time authentications for one client both see "not registered". Duplicates would cost a second `maxIssuers` slot and a second fetch, and leave `removeIssuer` dropping one source while the eviction takes ALL of that issuer's keys.

**A replaced source takes its keys with it.** A discovery document's published `issuer` wins over the declared one, so an entry can hold keys under a name it was not registered by; the replacement evicts them rather than leaving them in the vault where no source names them. And a fetch still in flight for a source that has since been replaced installs nothing — its keys would otherwise strip the replacement's, leaving `external.issuers()` naming one source while the vault serves another's.

### Refresh behaviour

- `setup()` is deferred — the first `find()` or `filter()` call triggers it automatically when external / idp sources are configured. `findSync()` / `filterSync()` / `findByIdSync()` throw if invoked beforehand. It fetches every DECLARED issuer in one parallel sweep, and throws when a `required` one (or the idp) fails.
- Concurrent calls to `setup()` or `refresh()` are deduplicated; only one network round-trip is in flight at a time. Concurrent `external.addIssuer` calls for one issuer are deduplicated the same way.
- Refresh is per-issuer. `amphora.refresh()` refetches the idp and every DECLARED external issuer; `amphora.external.refresh(issuer)` and `amphora.idp.refresh()` target one. A find-miss on `find({ id, issuer })` refetches that one issuer; a `findById(id)` miss carries no issuer to target with, so it refetches the declared set.
- After setup, async lookups re-fetch when the queried issuer's cache is older than `refreshInterval`. If the local vault already satisfies the query and the cache is fresh, no network call is made. A **stale** re-fetch that fails does not fail the lookup — the cached keys are served instead (see [a failed re-fetch does not deny a cached answer](#a-failed-re-fetch-does-not-deny-a-cached-answer)).
- **Strict at boot, lenient afterwards.** The sweep itself always tolerates partial failure — a failing issuer is logged and the others still land. Only the verdict at the end of the SETUP sweep is strict: a `required` issuer that failed throws its own error, so the process dies on the real cause. Every periodic refresh after that throws nothing; the previously fetched config and keys keep serving.
- Fetched keys whose `iss` claim does not match the configured `issuer` are rejected to prevent issuer spoofing.
- Rejection is per key, never per issuer: a JWK that cannot be parsed (e.g. one without an `alg`, which `@lindorm/kryptos` requires) is logged with its `kid` and skipped — the issuer's remaining keys still load. Only when _no_ key survives does the fetch itself fail for that issuer.

```typescript
await amphora.setup();
await amphora.refresh();
```

### Declared and registered issuers refresh differently

An issuer source is one of two things, and which one it is decides how it stays fresh:

- **Declared** — the constructor `external` array, and the `idp` however it arrived (including `idp.set()`). An operator's standing declaration: a handful of peers, known before the process starts.
- **Registered** — added at runtime through `external.addIssuer`. Sized by whoever registers: with one issuer per dynamically-registered client, that is the client population.

**The scheduled sweep covers declared issuers only.** `setup()`, `amphora.refresh()` and pylon's periodic refresh worker fetch the declared set and nothing else. A timer that refetched every registered issuer would poll the whole client population on one cadence — outbound traffic shaped like a DDoS from the recipients' side, and a synchronous JWK-parse spike to match.

A registered issuer is kept fresh by DEMAND instead, which reaches exactly the issuers actually in use:

- a **scoped** lookup — `find({ id, issuer })`, `filter({ issuer })` — refetches that issuer once its cache passes `refreshInterval`, the same bound a declared issuer gets;
- a **miss** on a scoped lookup refetches that issuer immediately;
- `external.refresh(issuer)` refetches it on demand.

⚠ **The cost, stated plainly: an UNSCOPED path does not reach a registered issuer** — neither for staleness nor for miss recovery, since `findById(id)` with no issuer routes to the declared sweep. Read a registered issuer's keys through a scoped lookup. An issuer nobody authenticates as has no key anyone reads, so there is nothing to go stale against.

### Retry and backoff

A failed load — discovery or JWKS — records the failure against that issuer and sets a retry floor of `refreshInterval` from now. Until then no **speculative** refetch happens for it: a stale cache stays stale rather than re-attempting a provider that just failed.

Flat, not exponential. A growing curve would stretch the window in which a key WITHDRAWN from a flapping issuer keeps verifying — a withdrawn-but-cached `kid` never misses, so only the speculative refetch retires it. A flat floor bounds that to `refreshInterval`.

⚠ **A MISS is never gated.** A client whose endpoint was failing and has since rotated a key is fetched on the spot; the backoff would otherwise lock out a working endpoint for the rest of the window. A success clears the retry state.

Failure logging follows provenance, because the two populations differ by orders of magnitude: a **declared** peer warns on the FIRST failure (an operator's dependency going down) and drops to `debug` for repeats, recovering at `info`; a **registered** issuer is `debug` throughout, since a per-client warn stream is unreadable at that N. Each sweep also emits one `verbose` summary.

### A failed re-fetch does not deny a cached answer

The same line one layer up. `find()` / `filter()` reach the network for two different reasons, and a failure means something different in each:

- **Staleness** — matching keys are already in the vault and only their age sent us out. The fetch failing changes nothing about those keys: they still verify, they are merely old. The failure is logged at `debug` and the **cached keys are returned**.
- **A miss** — nothing in the vault matches, so the fetch is the only thing that could produce an answer. Its failure **propagates the real cause** (the 503, the unreachable host), never a generic not-found. `find()` therefore rejects with the transport error rather than `kryptos_not_found_by_query_after_refresh`, and `findById()` — which is a miss by construction — does the same.

Without the first half, an issuer whose `jwks_uri` goes down costs one **failed authentication per `refreshInterval`** for the length of the outage, on a request holding a valid assertion and a valid cached key. Since the demand path is the only refresh a registered issuer gets, that is the routine case rather than the rare one.

⚠ **The cost, stated:** a key WITHDRAWN while the endpoint is down keeps verifying until the endpoint recovers. Accepted, because failing closed protected nothing — it denied the legitimate client whose keys are fine, and did nothing to an attacker, who is not hitting a stale entry to begin with.

`filterSync()` / `findSync()` / `findByIdSync()` never fetch, so none of this reaches them.

### Eviction is final

When `maxIssuers` is reached, registering another issuer evicts the least-recently-used one — its source and its keys both go.

**An evicted issuer does not come back on its own.** Amphora holds no source for it, so a later lookup for its keys fails and nothing refetches it; a targeted refresh finds no entry and no-ops. Re-registering is the CONSUMER's job — call `external.addIssuer` before the lookup that needs the issuer. A per-request registration flow already does exactly that, which is why the cap is safe for the case it was built for.

## Trust Anchors

Setting `trustAnchors` on an external provider entry pins the CAs that must sign certificates attached to fetched JWKs. The behavior depends on `trustMode`:

- **`strict` (default)** — every fetched JWK must include an `x5c` chain that validates against one of the supplied anchors. Keys without a chain are rejected.
- **`lax`** — keys without an `x5c` chain are accepted; keys that do include a chain still need to validate against the anchors.

```typescript
new Amphora({
  internal: { issuer: "https://auth.example.com" },
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

| Method         | Returns true when the vault contains an active key matching… |
| -------------- | ------------------------------------------------------------ |
| `canEncrypt()` | `{ use: "enc" }` — a public half or an oct secret.           |
| `canDecrypt()` | `{ use: "enc", hasPrivateKey: true }`                        |
| `canSign()`    | `{ use: "sig", hasPrivateKey: true }`                        |
| `canVerify()`  | `{ use: "sig" }`                                             |

`hasPrivateKey` is what excludes remotely-fetched keys: a JWKS only ever yields public halves, so a vault holding nothing but external sig keys can verify but not sign.

⚠ **The capability checks do NOT run through the publish gate.** They are not selections: `publish` says what belongs in our published JWKS, never what we are able to do, so a vault holding nothing but internal unpublished keys — a KEK, a CA, a cookie or session key — reports the capabilities those keys have. `find` / `filter` still hide them, and that is unchanged: a capability answers "can we do this at all", a query answers "which key do we hand out". Do not read `canDecrypt()` as "a vacuous `find({ use: "enc" })` will succeed" — it never meant that.

## Properties

```typescript
amphora.vault; // Array<IKryptos>
amphora.internal; // AmphoraInternalConfig | null — the service's OWN identity, derived from `internal.issuer`
// → { issuer, jwksUri } — `jwksUri` is null unless the issuer is an http(s) URL
amphora.jwks; // AmphoraJwks — throws AmphoraError when no issuer is configured
amphora.external; // IAmphoraExternal — foreign issuers
amphora.idp; // IAmphoraIdp — the upstream identity provider
```

Amphora names **three** issuer scopes, and each has its own accessor: `internal` (this service), `external` (foreign peers), `idp` (the one upstream).

`internal` is the service's own identity — `{ issuer, jwksUri }` derived from the `internal` setting, and `null` for a verify-only service that declares none. It is SINGULAR: a service has one identity or none, and it is the ONE reader of that setting: `amphora.internal?.issuer`, never a bare `amphora.issuer` that names no scope. `vault`, `internal`, `external.issuers()`, and `jwks.keys` getters return copies, so mutating the returned values does not affect internal state.

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

- Constructing with an `internal.issuer` that is not a URI (`internal_issuer_not_uri`) — a URL with an authority or a URN, never an opaque `foo:bar`.
- `add()` called with a key missing `id`, missing `issuer` (when the Amphora declares none), or already expired.
- `external.add()` called with a key missing `id`, or missing `issuer` (`kryptos_issuer_required`) — a foreign key names its own issuer and the Amphora's never stands in for it.
- A key write that would cross provenance (`kryptos_provenance_conflict`): `external.add()` / `external.remove()` naming a `(id, issuer)` slot that holds one of OUR keys, or `add()` / `env()` naming one that holds a FOREIGN key. Nothing is written; use the facet that owns the key.
- `findSync()` / `filterSync()` / `findByIdSync()` invoked before `setup()` when external providers are configured.
- Reading `amphora.jwks` when no `issuer` is configured (`issuer_required_for_jwks`).
- `find()` / `findById()` not finding a match after a refresh.
- An external issuer that is not a URI (`external_issuer_not_uri`), a `jwksUri` or `openIdConfigurationUri` that is not an http(s) URL (`external_jwks_uri_not_http_url`, `external_openid_configuration_uri_not_http_url`), an issuer that is not an http(s) URL with no `jwksUri` to discover from (`non_http_issuer_requires_jwks_uri`), or a source naming nothing amphora can discover or fetch from (`invalid_issuer_options`) — all validated synchronously at registration, before any network call.
- A discovery document that provides no `issuer` with none configured (`external_issuer_unresolved`) — a resolved external issuer must be a URI.
- Registering an issuer that already belongs to the other scope (`issuer_scope_conflict`) — an issuer is the idp **or** an external provider, never both — or `removeIssuer()` called with the idp's issuer (`remove_issuer_is_idp`; use `idp.clear()`).
- `idp.config()` called before an idp is set (`idp_not_configured`), or with one registered by `openIdConfigurationUri` alone whose issuer amphora has not settled (`idp_issuer_unresolved`).
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

The returned object implements `IAmphora`, including the `external` and `idp` facets — every method on those is a spy too (`external.issuers()` returns `[]`, `idp.config()` returns a stub config). `internal` is a stub `{ issuer: "mock_issuer", jwksUri: "mock_jwks_uri" }` matching the stub `issuer`. Each method is a spy from the corresponding test framework (`vi.fn()` / `jest.fn()`). Default return values: `find`, `findById`, `findSync`, and `findByIdSync` resolve to / return the string `"mock_kryptos"`; `filter` resolves to `[]`; `filterSync` returns `[]`; `setup` and `refresh` resolve to `undefined`; `canEncrypt`, `canDecrypt`, `canSign`, and `canVerify` return `true`. Override individual methods with the standard mock APIs (`mockReturnValue`, `mockResolvedValueOnce`, etc.).

## API Reference

### `class Amphora`

`new Amphora(options: AmphoraSettings)` — see [Constructor](#constructor).

**Methods**

| Signature                                                   | Description                                                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `add(kryptos: IKryptos \| Array<IKryptos>): void`           | Add one or more of OUR keys to the vault. Replaces by `(id, issuer)`; throws `kryptos_provenance_conflict` over a foreign key's slot.       |
| `env(keys: string \| Array<string>): void`                  | Decode `kryptos:` strings and add them.                                                                                                     |
| `setup(): Promise<void>`                                    | Resolve external configuration and load external JWKS. Throws when the idp cannot be resolved. Idempotent and deduplicated.                 |
| `refresh(): Promise<void>`                                  | Re-fetch the DECLARED sources' configuration and JWKS. Deduplicated.                                                                        |
| `find(query: AmphoraCondition): Promise<IKryptos>`          | First match, refreshing external keys when needed. Throws if not found — or throws the re-fetch's own failure when that is what stopped it. |
| `findSync(query: AmphoraCondition): IKryptos`               | First match against the local vault. Throws if not found.                                                                                   |
| `findById(id: string): Promise<IKryptos>`                   | Lookup by id, refreshing if external providers are configured.                                                                              |
| `findByIdSync(id: string): IKryptos`                        | Lookup by id against the local vault only.                                                                                                  |
| `filter(query: AmphoraCondition): Promise<Array<IKryptos>>` | All matches, refreshing when needed. A failed STALE re-fetch serves the cached matches; a failed MISS re-fetch throws.                      |
| `filterSync(query: AmphoraCondition): Array<IKryptos>`      | All matches against the local vault.                                                                                                        |
| `canEncrypt(): boolean`                                     | Has any active key suitable for encryption.                                                                                                 |
| `canDecrypt(): boolean`                                     | Has any active key suitable for decryption.                                                                                                 |
| `canSign(): boolean`                                        | Has any active key suitable for signing.                                                                                                    |
| `canVerify(): boolean`                                      | Has any active key suitable for verification.                                                                                               |

**Getters**

| Property   | Type                                             |
| ---------- | ------------------------------------------------ |
| `issuer`   | `string \| null`                                 |
| `vault`    | `Array<IKryptos>`                                |
| `internal` | `AmphoraInternalConfig \| null`                  |
| `jwks`     | `AmphoraJwks` (throws when no issuer configured) |
| `external` | `IAmphoraExternal`                               |
| `idp`      | `IAmphoraIdp`                                    |

### `interface IAmphoraExternal` (`amphora.external`)

| Signature                                                   | Description                                                                                                                                                                              |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add(kryptos: IKryptos \| Array<IKryptos>): void`           | Insert one or more foreign keys (⇒ `internal:false`). Each must carry its own `issuer`; replaces by `(id, issuer)`, and throws `kryptos_provenance_conflict` over one of OUR keys' slot. |
| `remove(id: string, issuer: string): void`                  | Drop one FOREIGN key by `(id, issuer)`. The issuer is required — a `kid` is unique only per issuer. A miss is a no-op; one of OUR keys throws `kryptos_provenance_conflict`.             |
| `addIssuer(source: AmphoraExternalSettings): Promise<void>` | Register an issuer source and fetch its keys; throws when the fetch fails, registering nothing. Idempotent by issuer — a re-registration replaces, and concurrent calls share one fetch. |
| `removeIssuer(issuer: string): void`                        | Drop the source and evict its keys.                                                                                                                                                      |
| `issuers(): Array<AmphoraExternalConfig>`                   | Every source whose issuer has settled.                                                                                                                                                   |
| `refresh(issuer: string): Promise<void>`                    | Refetch one issuer.                                                                                                                                                                      |

### `interface IAmphoraIdp` (`amphora.idp`)

| Signature                                        | Description                                                                                                                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set(source: AmphoraIdpSettings): Promise<void>` | Register or REPLACE the upstream, all-or-nothing. Awaits the fetch — throws when it fails, leaving the previous idp untouched; a successful swap evicts the old keys. |
| `config(): AmphoraExternalConfig`                | The resolved config — throws `idp_not_configured` when unset, `idp_issuer_unresolved` when unresolved.                                                                |
| `refresh(): Promise<void>`                       | Refetch the upstream.                                                                                                                                                 |
| `clear(): void`                                  | Unset the idp and evict its keys.                                                                                                                                     |

### `class AmphoraError extends LindormError`

Thrown for every failure surfaced by `Amphora`. Carries structured context on `error.debug`.

### `interface IAmphora`

Public interface implemented by `Amphora` and the mock factories.

### Types

```typescript
import type {
  AmphoraExternalConfig,
  AmphoraExternalSettings,
  AmphoraIdpSettings,
  AmphoraInternalConfig,
  AmphoraInternalSettings,
  AmphoraJwks,
  AmphoraKeySelector,
  AmphoraSettings,
  AmphoraCondition,
  AmphoraQuery,
  IAmphora,
  IAmphoraExternal,
  IAmphoraIdp,
} from "@lindorm/amphora";
```

## License

AGPL-3.0-or-later
