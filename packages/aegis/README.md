# @lindorm/aegis

JOSE token operations for JWT, JWS, and JWE backed by an Amphora key store.

## Installation

```bash
npm install @lindorm/aegis
```

This package is **ESM-only**. All examples use `import`; `require()` is not supported.

The `Aegis` class requires `@lindorm/amphora` (key store) and `@lindorm/logger` (logger) instances at construction time:

```bash
npm install @lindorm/amphora @lindorm/logger
```

## Overview

Aegis exposes two layers:

- **`Aegis`** — async façade that resolves keys from an `IAmphora` key store and delegates to the kit classes. Use this when you want JWT/JWS/JWE operations driven by a managed key store with `kid`-based lookup.
- **Kit classes** (`JwtKit`, `JwsKit`, `JweKit`, `SignatureKit`) — synchronous, single-key primitives. You supply an `IKryptos` key directly. Use these when you already have the key in hand and don't need the Amphora layer.

The `Aegis` instance methods are async because they perform key lookups. All kit instance methods are synchronous.

## Aegis

```typescript
import { Aegis } from "@lindorm/aegis";

const aegis = new Aegis({
  amphora, // IAmphora — key store
  logger, // ILogger
  issuer: "https://example.com", // optional; falls back to amphora.domain
  clockTolerance: 30, // optional, in seconds (default 0)
  encryption: "A256GCM", // optional, default "A256GCM"
  encAlgorithm: "ECDH-ES", // optional — restricts encryption key selection
  sigAlgorithm: "ES256", // optional — restricts signing key selection
  certBindingMode: "strict", // optional, "strict" | "lax" (default "strict")
  dpopMaxSkew: 60, // optional, in seconds (default 60)
});
```

### Namespaced operations

```typescript
const signed = await aegis.jwt.sign({
  expires: "1h",
  subject: "user-123",
  tokenType: "access_token",
  audience: ["https://api.example.com"],
  scope: ["read", "write"],
  claims: { role: "admin" },
});

const parsed = await aegis.jwt.verify(signed.token, {
  audience: "https://api.example.com",
  scope: ["read"],
});

const jws = await aegis.jws.sign("payload");
const verifiedJws = await aegis.jws.verify(jws.token);

const jwe = await aegis.jwe.encrypt("secret");
const decrypted = await aegis.jwe.decrypt(jwe.token);
```

### AES helpers

```typescript
const encoded = await aegis.aes.encrypt("data"); // base64 string
const record = await aegis.aes.encrypt("data", "record"); // AesEncryptionRecord
const serialised = await aegis.aes.encrypt("data", "serialised"); // SerialisedAesEncryption
const tokenised = await aegis.aes.encrypt("data", "tokenised"); // base64 string

const plain = await aegis.aes.decrypt(encoded);
```

### Universal verification

`aegis.verify` auto-detects JWT, JWS, and JWE compact serialisations. JWE inputs are decrypted first, then the inner payload is re-verified.

```typescript
const result = await aegis.verify(anyToken, {
  audience: "https://api.example.com",
});
```

### Static helpers

These do not need a key or amphora.

```typescript
Aegis.isJwt(token);
Aegis.isJws(token);
Aegis.isJwe(token);

Aegis.header(token); // decode the JOSE protected header
Aegis.decode(token); // auto-detect, decode without verifying
Aegis.parse(token); // auto-detect (JWT or JWS), validate structure

Aegis.parseUserinfo(claims); // → AegisUserinfo
Aegis.parseIntrospection(claims); // → AegisIntrospection
Aegis.validateClaims(claims, matchers); // throws on mismatch
```

## JwtKit

Synchronous JWT sign and verify against a single `IKryptos` key.

```typescript
import { JwtKit } from "@lindorm/aegis";

const kit = new JwtKit({
  issuer: "https://example.com",
  kryptos,
  logger,
  clockTolerance: 30, // seconds, optional
});

const signed = kit.sign({
  expires: "1h",
  subject: "user-123",
  tokenType: "access_token",
  audience: ["https://api.example.com"],
  claims: { role: "admin" },
});
// → { token, expiresAt, expiresIn, expiresOn, objectId, tokenId }

const parsed = kit.verify(signed.token, {
  audience: "https://api.example.com",
  scope: ["read"],
});

JwtKit.isJwt(token);
JwtKit.decode(token);
JwtKit.parse(token);
JwtKit.validate(payload, matchers);
```

## JwsKit

Synchronous JWS sign and verify over arbitrary `string` or `Buffer` data.

```typescript
import { JwsKit } from "@lindorm/aegis";

const kit = new JwsKit({ kryptos, logger });

const signed = kit.sign("hello world", { objectId: "msg-001" });
// → { token, objectId }

const parsed = kit.verify<string>(signed.token);
// parsed.payload === "hello world"

JwsKit.isJws(token);
JwsKit.decode(token);
JwsKit.parse(token);
```

## JweKit

Synchronous JWE encrypt and decrypt over `string` data.

```typescript
import { JweKit } from "@lindorm/aegis";

const kit = new JweKit({
  kryptos,
  logger,
  encryption: "A256GCM", // optional; falls back to kryptos.encryption
});

const encrypted = kit.encrypt("secret data", { objectId: "msg-002" });
// → { token }

const decrypted = kit.decrypt(encrypted.token);
// → { decoded, header, payload, token }

JweKit.isJwe(token);
JweKit.decode(token);
```

Compressed payloads (`zip` header) are explicitly rejected.

## SignatureKit

Low-level signature primitives over raw bytes. Dispatches to the appropriate driver kit based on `kryptos.type` (AKP / EC / OKP / RSA / oct).

```typescript
import { SignatureKit } from "@lindorm/aegis";

const kit = new SignatureKit({ kryptos });

const signature = kit.sign(data); // Buffer
const valid = kit.verify(data, signature); // boolean
kit.assert(data, signature); // throws on mismatch
const formatted = kit.format(signature); // string
```

## Sign content shape

`SignJwtContent` accepts the standard, OIDC, OAuth, PoP, delegation, and Lindorm claim families plus:

```typescript
{
  expires: string | Date;       // required, e.g. "1h", "30m", or a Date
  subject: string;              // required
  tokenType: string;            // required, e.g. "access_token"

  audience?: string[];
  claims?: Record<string, any>; // arbitrary custom claims
  scope?: string[];
  permissions?: string[];
  roles?: string[];
  groups?: string[];
  entitlements?: string[];
  clientId?: string;
  grantType?: string;
  tenantId?: string;
  sessionId?: string;
  nonce?: string;
  notBefore?: Date;
  authTime?: Date;
  authContextClass?: string;
  authFactor?: string[];
  authMethods?: string[];
  authorizedParty?: string;
  adjustedAccessLevel?: number;
  levelOfAssurance?: number;
  sessionHint?: string;
  subjectHint?: string;
  // …plus the rest of the StdClaims / OidcClaims / DelegationClaims surface
}
```

## Verify options

`VerifyJwtOptions` extends the claim matcher set. Each field accepts either a literal value or a `PredicateOperator` for flexible matching:

```typescript
await aegis.jwt.verify(token, {
  audience: "https://api.example.com",
  scope: ["read", "write"], // array contains
  tokenType: "access_token",
  subject: { $in: ["user-1", "user-2"] },
  levelOfAssurance: { $gte: 2 },
  authTime: { $gte: new Date("2024-01-01") },
});
```

Additional verify options:

- `actor` — controls token-delegation (`act`) chain enforcement
- `dpopProof` — when present, the verifier requires a `cnf.jkt` binding and validates the supplied DPoP proof
- `trustBoundThumbprint` — when `true`, allow a bound token without an inline DPoP proof (for cases where the binding is enforced out-of-band)

## Type guards

```typescript
import { isParsedJwt, isParsedJws } from "@lindorm/aegis";

const parsed = await aegis.verify(token);
if (isParsedJwt(parsed)) {
  /* parsed.payload typed as ParsedJwtPayload */
}
if (isParsedJws(parsed)) {
  /* parsed.payload typed as Buffer | string */
}
```

## Errors

```typescript
import {
  AegisError, // base class
  JwtError,
  JwsError,
  JweError,
} from "@lindorm/aegis";
```

## Security notes

- Signature/decryption keys are always sourced from the supplied `IAmphora`. The `jku`, `jwk`, `x5u`, `x5c`, `x5t`, and `x5t#S256` JOSE header parameters are never trusted as key sources during verification — only `kid` is used as a lookup key into Amphora.
- JWE payload compression (`zip` header) is rejected outright.
- Critical header parameters are enforced per RFC 7515 §4.1.11; unknown `crit` entries cause verification to fail.
- DPoP-bound tokens (`cnf.jkt`) require either a matching DPoP proof or `trustBoundThumbprint: true` on verify.

## Testing

The package ships pre-built mock factories for both Jest and Vitest. Import from the runner-specific subpath:

```typescript
// Jest
import { createMockAegis } from "@lindorm/aegis/mocks/jest";

// Vitest
import { createMockAegis } from "@lindorm/aegis/mocks/vitest";

const aegis = createMockAegis(); // fully mocked IAegis
```

## License

AGPL-3.0-or-later
