# @lindorm/amphora

Cryptographic key vault for managing [Kryptos](https://www.npmjs.com/package/@lindorm/kryptos) keys. Handles local key storage, JWKS serving, and automatic discovery of external keys from OpenID Connect providers.

## Installation

```bash
npm install @lindorm/amphora
```

## Overview

Amphora acts as a centralized vault for cryptographic keys. It stores local keys you generate, serves them as a JWKS endpoint, and can discover and cache keys from external identity providers via OpenID Connect. Keys are queried using a predicate-based filter system.

## Quick Start

```typescript
import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createLogger } from "@lindorm/logger";

const amphora = new Amphora({
  domain: "https://auth.example.com",
  logger: createLogger(),
});

// Add a signing key
const key = KryptosKit.generate.auto({ algorithm: "ES512", use: "sig" });
amphora.add(key);

// Find it later
const found = await amphora.find({ use: "sig" });
```

## Constructor Options

```typescript
new Amphora({
  // Your server's domain. Used as the default issuer for added keys,
  // and determines which keys appear in the JWKS output.
  domain: "https://auth.example.com",

  // Required. Logger instance.
  logger,

  // External OIDC providers to discover keys from.
  external: [
    { issuer: "https://accounts.google.com" },
  ],

  // Max keys to accept per external provider. Default: 100.
  maxExternalKeys: 100,

  // How long before external keys are considered stale. Default: 300000 (5 min).
  refreshInterval: 300_000,
});
```

## Adding Keys

### From Kryptos instances

```typescript
const sigKey = KryptosKit.generate.auto({ algorithm: "ES512", use: "sig" });
const encKey = KryptosKit.generate.auto({ algorithm: "ECDH-ES", use: "enc", curve: "X25519" });

// Single or array
amphora.add(sigKey);
amphora.add([sigKey, encKey]);
```

When `domain` is set, Amphora auto-assigns `issuer` and `jwksUri` to added keys that don't already have them. Keys are deduplicated by `id` — adding a key with the same id replaces the previous one. Expired keys are rejected.

### From environment variables

Kryptos keys can be serialized to compact `kryptos:` strings for storage in environment variables.

```typescript
// Single string or array
amphora.env(process.env.SIGNING_KEY!);
amphora.env([process.env.SIGNING_KEY!, process.env.ENCRYPTION_KEY!]);
```

These strings are produced by `KryptosKit.env.export(key)` and decoded by `KryptosKit.env.import(str)`.

## Finding Keys

### Async (with external refresh)

The async methods trigger a refresh from external providers when results are stale or empty.

```typescript
// Find first match (throws AmphoraError if none found)
const key = await amphora.find({ id: "some-uuid" });

// Filter all matches
const keys = await amphora.filter({ use: "sig", type: "EC" });
```

### Sync (local vault only)

The sync methods search the local vault without any network calls. If external providers are configured, `setup()` must have been called first.

```typescript
const key = amphora.findSync({ id: "some-uuid" });
const keys = amphora.filterSync({ use: "enc" });
```

### Query format

Queries are predicates over key attributes. Simple values are equality checks. MongoDB-style operators are supported for more complex filters.

```typescript
// Simple equality
await amphora.filter({ use: "sig", type: "EC" });

// $in / $nin
await amphora.filter({ algorithm: { $in: ["ES256", "ES384", "ES512"] } });

// $or / $and / $nor
await amphora.filter({
  $or: [
    { operations: { $in: ["encrypt"] } },
    { operations: { $in: ["deriveKey"] } },
  ],
});
```

Available query fields (from `KryptosAttributes` and `KryptosMetadata`):

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Key UUID |
| `algorithm` | `string` | JOSE algorithm (ES512, RS256, EdDSA, etc.) |
| `curve` | `string` | EC/OKP curve (P-256, Ed25519, X25519, etc.) |
| `encryption` | `string` | Content encryption algorithm (A256GCM, etc.) |
| `hasPrivateKey` | `boolean` | Whether the key contains private material |
| `hasPublicKey` | `boolean` | Whether the key contains public material |
| `isExternal` | `boolean` | Whether the key was imported from an external provider |
| `issuer` | `string` | Issuing authority URL |
| `operations` | `string[]` | Allowed operations (sign, verify, encrypt, decrypt, etc.) |
| `ownerId` | `string` | Tenant/owner identifier |
| `purpose` | `string` | Key purpose (cookie, session, token) |
| `type` | `"EC" \| "RSA" \| "oct" \| "OKP"` | Key type |
| `use` | `"sig" \| "enc"` | Signature or encryption |

All queries automatically filter out inactive keys (expired or not-yet-valid).

## JWKS Endpoint

When `domain` is set, Amphora maintains a JWKS containing the public keys of all active, non-hidden, non-external keys whose issuer matches the domain.

```typescript
// Serve at /.well-known/jwks.json
app.get("/.well-known/jwks.json", (req, res) => {
  res.json(amphora.jwks);
});
```

The `jwks` getter returns `{ keys: Array<LindormJwk> }`. Keys are sorted newest-first by creation date.

## External Providers

Amphora can discover and cache keys from external OpenID Connect providers. This is useful for verifying tokens issued by third-party identity providers.

### Configuration

Three ways to specify an external provider:

```typescript
const amphora = new Amphora({
  domain: "https://auth.example.com",
  logger,
  external: [
    // 1. Issuer only — discovers via {issuer}/.well-known/openid-configuration
    { issuer: "https://accounts.google.com" },

    // 2. Issuer + JWKS URI directly (skips OpenID discovery)
    {
      issuer: "https://partner-api.com",
      jwksUri: "https://partner-api.com/.well-known/jwks.json",
    },

    // 3. Explicit OpenID configuration URI
    {
      openIdConfigurationUri: "https://login.microsoftonline.com/v2.0/.well-known/openid-configuration",
    },
  ],
});

// Fetch external configs and keys
await amphora.setup();
```

### Refresh behaviour

- `setup()` is lazy — the first `find()`/`filter()` call triggers it automatically if not already called.
- Concurrent calls to `setup()` or `refresh()` are deduplicated (only one in-flight request).
- After the initial setup, `filter()`/`find()` will re-fetch external keys when the cache is stale (older than `refreshInterval`).
- If the local vault already has matching results and the cache is fresh, no network call is made.
- Partial failures are tolerated — if some providers fail but others succeed, the vault is updated with what's available. Only if _all_ providers fail does it throw.

### Manual refresh

```typescript
await amphora.refresh();
```

## Capability Checks

Quick boolean checks for what the vault can do, based on key operations and use flags:

```typescript
amphora.canEncrypt(); // has keys with encrypt/deriveKey/wrapKey ops or use:"enc"
amphora.canDecrypt(); // has keys with decrypt/deriveKey/unwrapKey ops or use:"enc"
amphora.canSign();    // has keys with sign ops or use:"sig"
amphora.canVerify();  // has keys with verify ops or use:"sig"
```

## Properties

```typescript
amphora.domain;  // string | null — the configured domain
amphora.vault;   // Array<IKryptos> — copy of all keys in the vault
amphora.config;  // Array<AmphoraConfig> — copy of resolved external provider configs
amphora.jwks;    // AmphoraJwks — { keys: Array<LindormJwk> } (throws if no domain)
```

All getters return copies to prevent external mutation.

## Error Handling

All errors are `AmphoraError` (extends `LindormError`).

```typescript
import { AmphoraError } from "@lindorm/amphora";

try {
  await amphora.find({ id: "nonexistent" });
} catch (error) {
  if (error instanceof AmphoraError) {
    // error.debug contains { queryKeys, totalKeys, activeKeys }
  }
}
```

Common error scenarios:
- Adding a key without an `id`
- Adding a key without an `issuer` (when no `domain` is set)
- Adding an expired key
- Accessing `jwks` when no `domain` is configured
- `findSync()`/`filterSync()` before `setup()` when external providers are configured
- Key not found after exhausting local vault and external refresh

## Testing

A mock factory is provided for unit tests:

```typescript
import { createMockAmphora } from "@lindorm/amphora";

const amphora = createMockAmphora();
// All methods are jest.fn() stubs
// find/findSync return "mock_kryptos"
// filter/filterSync return []
// canEncrypt/canDecrypt/canSign/canVerify return true
```

## Types

```typescript
import type {
  AmphoraConfig,
  AmphoraExternalOption,
  AmphoraJwks,
  AmphoraOptions,
  AmphoraQuery,
} from "@lindorm/amphora";

import type { IAmphora } from "@lindorm/amphora";
```

## License

AGPL-3.0-or-later
