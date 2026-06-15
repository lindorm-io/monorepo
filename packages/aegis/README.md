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

- **`Aegis`** — async façade that resolves keys from an `IAmphora` key store and delegates to the kit classes. Use this when you want JWT/JWS/JWE or COSE/CWT operations driven by a managed key store with `kid`-based lookup.
- **Kit classes** (`JwtKit`, `JwsKit`, `JweKit`, `SignatureKit`, plus the `CoseKit` COSE facade) — synchronous, single-key primitives. You supply an `IKryptos` key directly. Use these when you already have the key in hand and don't need the Amphora layer.

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

`aegis.verify` auto-detects JWT, JWS, and JWE compact serialisations. JWE inputs are decrypted first, then the inner payload is re-verified. A COSE token (base64url CBOR, no JOSE dot structure) is also auto-detected and its integrity verified — see [COSE / CWT](#cose--cwt).

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

## COSE / CWT

Every token profile can be issued as a CBOR Web Token (CWT, RFC 8392) instead of a JWT by passing `format: "cose"` — the same profile, the same domain claims, the same validation floor, only the wire encoding differs. The token is returned as a base64url string.

```typescript
const { token } = await aegis.mint(
  "access_token",
  { subject: "user-123", audience: ["https://api.example.com"], clientId: "app-1" },
  { format: "cose" },
);

const verified = await aegis.verify("access_token", token, {
  format: "cose",
  audience: "https://api.example.com",
});

// …or let aegis auto-detect it (no profile, no format flag — integrity only):
const smart = await aegis.verify(token);
```

### Token structure

The COSE structure follows the key and the profile:

- **Signed** — an asymmetric key produces a `COSE_Sign1` (the default).
- **MAC'd** — a symmetric `oct` key produces a `COSE_Mac0` (HMAC is a MAC algorithm, never a `COSE_Sign1` signature). The same `algClass` policy applies as for JWTs.
- **Encrypted** — an encryptable profile minted with `encrypt` (or carrying `sensitive_identity`) is sign-then-encrypted into a `COSE_Encrypt0`. Direct AES-GCM and AES-CCM (all eight RFC 9053 variants) are supported.

### `typ` and proprietary encoding

The COSE `typ` header carries the CWT media type — `application/at+cwt`, `application/secevent+cwt`, etc. (the JWT path's `application/at+jwt` family with the `+jwt` suffix swapped for `+cwt`; bare `JWT` → `application/cwt`, the one IANA-registered CWT type).

By default the claims use lindorm-proprietary compact encodings (integer-keyed `act` / `sub_id`, private-use labels for lindorm-only claims). Pass `proprietary: false` to emit a fully interoperable, string-keyed payload that a stock COSE/CWT verifier reads, at the cost of larger tokens:

```typescript
await aegis.mint("access_token", content, { format: "cose", proprietary: false });
```

Either way the signature itself is plain RFC 9052 — verified in interop tests against `@auth0/cose` and `cose-js`.

### CoseKit

`CoseKit` is the synchronous facade behind the COSE path (the COSE analogue of the JOSE kits). It also exposes the **COSE Key Thumbprint** (`ckt`, RFC 9679):

```typescript
import { CoseKit } from "@lindorm/aegis";

const ckt = CoseKit.thumbprint(kryptos); // raw SHA-256 digest bytes
const uri = CoseKit.thumbprintUri(kryptos); // urn:ietf:params:oauth:ckt:sha-256:…
```

> The `ckt` is **not** the same value as `kryptos.thumbprint` (the RFC 7638 `jkt`): the `ckt` hashes the deterministic-CBOR COSE_Key, the `jkt` hashes the canonical JSON JWK, so the same key has two different fingerprints. They are not interchangeable in a key-binding check.

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
  authorizationDetails?: AuthorizationDetail[]; // RFC 9396 (RAR) — see below
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
  levelOfAssurance?: number;
  sessionHint?: string;
  subjectHint?: string;
  // …plus the rest of the StdClaims / OidcClaims / DelegationClaims surface
}
```

### Rich Authorization Requests (RFC 9396)

`authorizationDetails` carries the RFC 9396 `authorization_details` claim. The
domain name (`authorizationDetails`) is translated to the registered wire name
(`authorization_details`) on sign and back on parse. The array **contents travel
verbatim** — type-specific inner fields (e.g. `instructedAmount`,
`creditorAccount`) are never key-converted, so camelCase fields defined by a
detail's own spec are preserved exactly. The claim also surfaces from
`parseIntrospection` (RFC 9396 §9).

```typescript
kit.sign({
  expires: "1h",
  subject: "user-123",
  tokenType: "access_token",
  authorizationDetails: [
    {
      type: "payment_initiation",
      actions: ["initiate"],
      locations: ["https://api.bank.example.com/payments"],
      instructedAmount: { currency: "EUR", amount: "123.50" }, // verbatim
    },
  ],
});
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

- Signature/decryption keys are always sourced from the supplied `IAmphora`. The `jku`, `jwk`, `x5u`, `x5c`, `x5t`, and `x5t#S256` JOSE header parameters are never trusted as key sources during verification — only `kid` is used as a lookup key into Amphora. The COSE verify path is the same: the signing/encryption key is resolved only by the COSE `kid` (unprotected header, label 4), never from anything embedded in the token.
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
