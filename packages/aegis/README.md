# @lindorm/aegis

Token operations for JWT, JWE, JWS, CWT (CBOR Web Token), CWS (COSE Sign1), and CWE (COSE Encrypt).

## Installation

```bash
npm install @lindorm/aegis
```

## Overview

Aegis provides two usage patterns:

- **Aegis class** — async wrapper that resolves keys from an `IAmphora` key store before delegating to Kit classes.
- **Kit classes** (`JwtKit`, `CwtKit`, `CwsKit`, etc.) — synchronous, single-key operations. You supply an `IKryptos` key directly.

The Aegis class methods are **async** because they perform key lookups. All Kit class methods are **synchronous**.

## Aegis Class

Async wrapper that resolves keys from an `IAmphora` key store. All operations are async.

```typescript
import { Aegis } from "@lindorm/aegis";

const aegis = new Aegis({
  amphora,
  logger,
  issuer: "https://example.com",
  clockTolerance: 30000, // ms, optional
  encryption: "A256GCM", // optional, default "A256GCM"
  encAlgorithm: "ECDH-ES", // optional, default encryption algorithm
  sigAlgorithm: "ES256", // optional, default signing algorithm
});
```

### Namespaced operations

```typescript
// JWT
const signed = await aegis.jwt.sign({
  expires: "1h",
  subject: "u1",
  tokenType: "access_token",
});
const parsed = await aegis.jwt.verify(signed.token);

// CWT
const cwt = await aegis.cwt.sign({
  expires: "1h",
  subject: "u1",
  tokenType: "access_token",
});
const cwtParsed = await aegis.cwt.verify(cwt.token);

// JWS / CWS — sign and verify arbitrary data
const jws = await aegis.jws.sign("data");
const cws = await aegis.cws.sign("data");

// JWE / CWE — encrypt and decrypt
const jwe = await aegis.jwe.encrypt("secret");
const cwe = await aegis.cwe.encrypt("secret");

// AES — returns base64 encoded string by default
const encoded = await aegis.aes.encrypt("data");
const record = await aegis.aes.encrypt("data", "record");
const serialised = await aegis.aes.encrypt("data", "serialised");
const decrypted = await aegis.aes.decrypt(encoded);
```

### Universal verification

Automatically detects token type and verifies/decrypts accordingly.

```typescript
const result = await aegis.verify(anyToken, {
  audience: "https://api.example.com",
});
// Works with JWT, JWE, JWS, CWT, CWE, or CWS
// JWE/CWE tokens are decrypted, then their inner payload is verified
```

### Static methods

No key or amphora required.

```typescript
Aegis.isJwt(token);
Aegis.isCwt(token);
Aegis.isJws(token);
Aegis.isCws(token);
Aegis.isJwe(token);
Aegis.isCwe(token);

Aegis.header(token); // TokenHeaderClaims (JOSE tokens only)
Aegis.decode(token); // auto-detect and decode without verification
Aegis.parse(token); // auto-detect, decode, and validate structure
```

## Kit Classes

### JwtKit

Signs and verifies JSON Web Tokens.

```typescript
import { JwtKit } from "@lindorm/aegis";

const kit = new JwtKit({ issuer: "https://example.com", logger, kryptos });

// Sign — returns { token, expiresAt, expiresIn, expiresOn, objectId, tokenId }
const signed = kit.sign({
  expires: "1h",
  subject: "user-123",
  tokenType: "access_token",
  audience: ["https://api.example.com"],
  claims: { role: "admin" },
  scope: ["read", "write"],
});

// Verify — returns { decoded, header, payload, token }
const parsed = kit.verify(signed.token, {
  audience: "https://api.example.com",
  scope: ["read"],
});

// Static methods (no key required)
JwtKit.isJwt(token); // boolean
JwtKit.decode(token); // { header, payload, signature }
JwtKit.parse(token); // { decoded, header, payload, token }
JwtKit.validate(payload, options); // throws on mismatch
```

### CwtKit

Signs and verifies CBOR Web Tokens (RFC 8392). Uses COSE Sign1 structure with CBOR-encoded payloads and integer claim labels.

```typescript
import { CwtKit } from "@lindorm/aegis";

const kit = new CwtKit({ issuer: "https://example.com", logger, kryptos });

// Sign — returns { buffer, token, expiresAt, expiresIn, expiresOn, objectId, tokenId }
const signed = kit.sign({
  expires: "1h",
  subject: "user-123",
  tokenType: "access_token",
  claims: { 900: "custom-value", 901: 42 }, // integer labels >= 900
});

// Verify — accepts Buffer or base64url string
const parsed = kit.verify(signed.token, {
  tokenType: "access_token",
});

// Static methods
CwtKit.isCwt(token);
CwtKit.decode(token);
CwtKit.parse(token);
CwtKit.validate(payload, options);
```

**COSE target modes:** Pass `{ target: "external" }` to sign options to emit string keys for proprietary labels instead of integer CBOR labels. Standard RFC claims (iss, sub, exp, etc.) always use integer labels regardless of target.

**Custom claim labels:** Numeric keys >= 900 in the `claims` object are encoded as compact integer CBOR labels. Keys below 900 are rejected to prevent collision with IANA-assigned (1-255) and Lindorm-reserved (400-599) ranges.

### CwsKit

Signs and verifies arbitrary data using COSE Sign1 (RFC 9052).

```typescript
import { CwsKit } from "@lindorm/aegis";

const kit = new CwsKit({ logger, kryptos });

// Sign string or Buffer — returns { buffer, objectId, token }
const signed = kit.sign("hello world", {
  objectId: "msg-001",
  target: "internal", // or "external"
});

// Verify — returns { decoded, header, payload, token }
const parsed = kit.verify(signed.token);
// parsed.payload === "hello world"

// Static methods
CwsKit.isCws(token);
CwsKit.decode(token);
CwsKit.parse(token);
```

### CweKit

Encrypts and decrypts data using COSE Encrypt (RFC 9052).

```typescript
import { CweKit } from "@lindorm/aegis";

const kit = new CweKit({ logger, kryptos, encryption: "A256GCM" });

// Encrypt string or Buffer — returns { buffer, token }
const encrypted = kit.encrypt("secret data", {
  objectId: "msg-002",
  target: "internal",
});

// Decrypt — returns { decoded, header, payload, token }
const decrypted = kit.decrypt(encrypted.token);
// decrypted.payload === "secret data"

// Static methods
CweKit.isCwe(token);
CweKit.decode(token);
```

### JwsKit

Signs and verifies arbitrary data using JSON Web Signatures.

```typescript
import { JwsKit } from "@lindorm/aegis";

const kit = new JwsKit({ logger, kryptos });

// Sign string or Buffer — returns { objectId, token }
const signed = kit.sign("hello world", { objectId: "msg-003" });

// Verify — returns { decoded, header, payload, token }
const parsed = kit.verify(signed.token);

// Static methods
JwsKit.isJws(token);
JwsKit.decode(token);
JwsKit.parse(token);
```

### JweKit

Encrypts and decrypts data using JSON Web Encryption.

```typescript
import { JweKit } from "@lindorm/aegis";

const kit = new JweKit({ logger, kryptos, encryption: "A256GCM" });

// Encrypt string — returns { token }
const encrypted = kit.encrypt("secret data", { objectId: "msg-004" });

// Decrypt — returns { decoded, header, payload, token }
const decrypted = kit.decrypt(encrypted.token);

// Static methods
JweKit.isJwe(token);
JweKit.decode(token);
```

### SignatureKit

Low-level signature operations over raw data.

```typescript
import { SignatureKit } from "@lindorm/aegis";

const kit = new SignatureKit({ kryptos });

const signature = kit.sign(data); // Buffer
const valid = kit.verify(data, signature); // boolean
kit.assert(data, signature); // throws if invalid
kit.format(signature); // string
```

## Sign Content

The `SignJwtContent` / `SignCwtContent` types share the same shape:

```typescript
{
  // Required
  expires: string | Date;   // "1h", "30m", Date, etc.
  subject: string;
  tokenType: string;

  // Optional
  audience?: string[];
  claims?: Record<string, any>;  // custom claims (CWT supports integer keys >= 900)
  scope?: string[];
  permissions?: string[];
  roles?: string[];
  clientId?: string;
  grantType?: string;
  tenantId?: string;
  sessionId?: string;
  nonce?: string;
  notBefore?: Date;
  authTime?: Date;
  authContextClass?: string;
  authFactor?: string;
  authMethods?: string[];
  authorizedParty?: string;
  adjustedAccessLevel?: number;
  levelOfAssurance?: number;
  sessionHint?: string;
  subjectHint?: string;
}
```

## Verify Options

All fields are optional and support `PredicateOperator` for flexible matching:

```typescript
kit.verify(token, {
  audience: "https://api.example.com", // exact match
  scope: ["read", "write"], // array contains
  tokenType: { $eq: "access_token" }, // predicate operator
  subject: { $in: ["user-1", "user-2"] }, // set membership
  levelOfAssurance: { $gte: 2 }, // numeric comparison
});
```

## Errors

```typescript
import {
  AegisError, // base error
  JwtError,
  JwsError,
  JweError,
  CwtError,
  CoseSignError,
  CoseEncryptError,
} from "@lindorm/aegis";
```

## Testing

```typescript
import { createMockAegis } from "@lindorm/aegis";

const aegis = createMockAegis(); // fully mocked IAegis with jest.fn() stubs
```

## License

AGPL-3.0-or-later
