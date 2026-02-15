# @lindorm/aes

High-level **AES encryption & decryption** for Node.js with first-class
TypeScript support. `@lindorm/aes` wraps key derivation, key wrapping, and
authenticated content encryption behind a single `AesKit` class — so you can
encrypt any data type in one call and get back a string, a structured record, or
a compact token.

It includes:

- `AesKit` — encrypt / decrypt / verify / assert in four output formats
- **28 algorithm × encryption combinations** out of the box (EC, OKP, RSA, oct)
- JWE-aligned key derivation: ECDH-ES, AES-KW, AES-GCM-KW, PBKDF2, RSA-OAEP
- Automatic content-type detection (string, Buffer, object, array, number)
- Static helpers for format detection and parsing

---

## Installation

```bash
npm install @lindorm/aes
# or
yarn add @lindorm/aes
```

Requires Node >= 18 and `@lindorm/kryptos` for key management.

---

## Quick start

### Encrypt and decrypt

```ts
import { AesKit } from "@lindorm/aes";
import { KryptosKit } from "@lindorm/kryptos";

// Generate an encryption key — Kryptos defaults to A256GCM content encryption
const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A256KW" });
const aes = new AesKit({ kryptos });

const encrypted = aes.encrypt("Hello World"); // base64url string
const decrypted = aes.decrypt(encrypted); // "Hello World"
```

### Choose an output format

```ts
// Encoded — single base64url string (default)
const encoded = aes.encrypt("secret");

// Record — object with raw Buffer values
const record = aes.encrypt("secret", "record");

// Serialised — object with base64 strings (JSON-safe)
const serialised = aes.encrypt("secret", "serialised");
const json = JSON.stringify(serialised);

// Tokenised — human-readable $-delimited string
const token = aes.encrypt("secret", "tokenised");
// "$A256GCM$v=11,kid=...,alg=A256KW,cty=text/plain,iv=...,tag=...$<content>$"
```

All four formats are accepted by `decrypt`, `verify`, and `assert`:

```ts
aes.decrypt(encoded); // works
aes.decrypt(record); // works
aes.decrypt(JSON.parse(json)); // works
aes.decrypt(token); // works
```

### Encrypt any content type

```ts
aes.encrypt("plain text"); // string
aes.encrypt(Buffer.from("binary")); // Buffer
aes.encrypt({ user: "alice", role: "admin" }); // object
aes.encrypt([1, 2, 3]); // array
aes.encrypt(42); // number

// Content type is tracked — decrypt returns the original type
const obj = aes.decrypt<{ user: string }>(cipher); // { user: "alice", ... }
```

### Verify and assert

```ts
const cipher = aes.encrypt("secret");

aes.verify("secret", cipher); // true
aes.verify("wrong", cipher); // false

aes.assert("secret", cipher); // void — passes silently
aes.assert("wrong", cipher); // throws AesError("Invalid AES cipher")
```

### Additional Authenticated Data (AAD)

```ts
const aad = Buffer.from("request-id:abc-123");

const cipher = aes.encrypt("payload", "encoded", { aad });

aes.decrypt(cipher, { aad }); // "payload"
aes.decrypt(cipher); // throws — AAD mismatch
aes.decrypt(cipher, { aad: Buffer.from("wrong") }); // throws
```

---

## Supported algorithms

### Content encryption

| Encryption      | Mode | Key bits | Auth                        |
| --------------- | ---- | -------- | --------------------------- |
| `A128GCM`       | GCM  | 128      | built-in auth tag           |
| `A192GCM`       | GCM  | 192      | built-in auth tag           |
| `A256GCM`       | GCM  | 256      | built-in auth tag (default) |
| `A128CBC-HS256` | CBC  | 128      | HMAC-SHA256                 |
| `A192CBC-HS384` | CBC  | 192      | HMAC-SHA384                 |
| `A256CBC-HS512` | CBC  | 256      | HMAC-SHA512                 |

### Key algorithms

| Key type        | Algorithms                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| EC              | `ECDH-ES`, `ECDH-ES+A128KW`, `ECDH-ES+A192KW`, `ECDH-ES+A256KW`, `ECDH-ES+A128GCMKW`, `ECDH-ES+A192GCMKW`, `ECDH-ES+A256GCMKW` |
| OKP             | `ECDH-ES`, `ECDH-ES+A128KW`, `ECDH-ES+A192KW`, `ECDH-ES+A256KW`, `ECDH-ES+A128GCMKW`, `ECDH-ES+A192GCMKW`, `ECDH-ES+A256GCMKW` |
| RSA             | `RSA-OAEP-256`, `RSA-OAEP-384`, `RSA-OAEP-512`                                                                                 |
| oct (symmetric) | `A128KW`, `A192KW`, `A256KW`, `A128GCMKW`, `A192GCMKW`, `A256GCMKW`, `dir`                                                     |
| oct (password)  | `PBES2-HS256+A128KW`, `PBES2-HS384+A192KW`, `PBES2-HS512+A256KW`                                                               |

Every key algorithm can be combined with every content encryption — giving you
28+ working combinations.

---

## API reference

### `new AesKit(options)`

```ts
import { AesKit } from "@lindorm/aes";

const aes = new AesKit({ kryptos });

aes.kryptos; // the IKryptos instance (public readonly)
```

The content encryption algorithm is read from `kryptos.encryption` (defaults to
`A256GCM` for generated enc keys). You can override it for imported keys that
lack an encryption preference:

```ts
const imported = KryptosKit.from.jwk(externalJwk);
const aes = new AesKit({ kryptos: imported, encryption: "A128GCM" });
```

### `aes.encrypt(data, mode?, options?)`

Encrypts data and returns one of four formats depending on `mode`:

| Mode                  | Return type               | Description                            |
| --------------------- | ------------------------- | -------------------------------------- |
| `"encoded"` (default) | `string`                  | Base64url-encoded binary blob          |
| `"record"`            | `AesEncryptionRecord`     | Object with raw `Buffer` values        |
| `"serialised"`        | `SerialisedAesEncryption` | Object with base64 strings — JSON-safe |
| `"tokenised"`         | `string`                  | `$`-delimited human-readable token     |

```ts
encrypt(data: AesContent, mode?: "encoded", options?: AesOperationOptions): string;
encrypt(data: AesContent, mode: "record", options?: AesOperationOptions): AesEncryptionRecord;
encrypt(data: AesContent, mode: "serialised", options?: AesOperationOptions): SerialisedAesEncryption;
encrypt(data: AesContent, mode: "tokenised", options?: AesOperationOptions): string;
```

### `aes.decrypt<T>(data, options?)`

Decrypts any supported format back to the original content.

```ts
decrypt<T extends AesContent = string>(
  data: AesDecryptionRecord | SerialisedAesDecryption | string,
  options?: AesOperationOptions,
): T;
```

Format is auto-detected: encoded string, tokenised string, record object, or
serialised object all work transparently.

### `aes.verify(input, data, options?)`

Returns `true` if decrypted data deeply equals `input`, `false` otherwise.
Never throws.

```ts
verify(
  input: AesContent,
  data: AesDecryptionRecord | SerialisedAesDecryption | string,
  options?: AesOperationOptions,
): boolean;
```

### `aes.assert(input, data, options?)`

Throws `AesError("Invalid AES cipher")` if decrypted data does not match
`input`.

```ts
assert(
  input: AesContent,
  data: AesDecryptionRecord | SerialisedAesDecryption | string,
  options?: AesOperationOptions,
): void;
```

### Static methods

```ts
// Detect content type of any input
AesKit.contentType("hello"); // "text/plain"
AesKit.contentType(Buffer.from("")); // "application/octet-stream"
AesKit.contentType({ a: 1 }); // "application/json"

// Check if a string is in tokenised format
AesKit.isAesTokenised("$A256GCM$v=11,alg=...$...$"); // true
AesKit.isAesTokenised("base64string"); // false

// Parse any format into an AesDecryptionRecord (Buffer values)
const record = AesKit.parse(encodedString);
const record2 = AesKit.parse(tokenisedString);
const record3 = AesKit.parse(serialisedObject);
```

---

## Output formats

### Encoded

A single base64url string containing version, metadata, and ciphertext in a
compact binary layout. Best for storage and transmission where a single opaque
string is ideal.

### Record

A plain object with raw `Buffer` values for all binary fields (`authTag`,
`content`, `initialisationVector`, etc.). Useful when you need programmatic
access to individual encryption components.

### Serialised

Same structure as record, but all `Buffer` fields are base64-encoded strings.
Safe for `JSON.stringify` / `JSON.parse` round-trips.

### Tokenised

A human-readable `$`-delimited string:

```
$<encryption>$<key=value pairs>$<base64url content>$
```

Metadata fields: `v` (version), `kid` (key ID), `alg` (algorithm),
`cty` (content type), `iv`, `tag`, and optional `p2c`, `p2s`, `pei`, `pek`,
`pet`, `crv`, `kty`, `x`, `y` for key exchange parameters.

---

## Type definitions

### Core types

```ts
type AesContent = Array<any> | Buffer | Dict | number | string;

type AesContentType = "application/json" | "application/octet-stream" | "text/plain";

type AesEncryptionMode = "encoded" | "record" | "serialised" | "tokenised";

type AesKitOptions = {
  encryption?: KryptosEncryption;
  kryptos: IKryptos;
};

type AesOperationOptions = {
  aad?: Buffer;
};
```

### Encryption record

```ts
type AesEncryptionRecord = {
  algorithm: KryptosAlgorithm;
  authTag: Buffer;
  content: Buffer;
  contentType: AesContentType;
  encryption: KryptosEncryption;
  initialisationVector: Buffer;
  keyId: string;
  pbkdfIterations: number | undefined;
  pbkdfSalt: Buffer | undefined;
  publicEncryptionIv: Buffer | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionKey: Buffer | undefined;
  publicEncryptionTag: Buffer | undefined;
  version: number;
};
```

### Serialised record

Same shape as `AesEncryptionRecord`, but all `Buffer` fields are `string`
(base64-encoded).

### Decryption records

`AesDecryptionRecord` and `SerialisedAesDecryption` mirror their encryption
counterparts, with most fields optional — only `content`, `encryption`, and
`initialisationVector` are required.

---

## Utility functions

```ts
import {
  isAesBufferData,
  isAesSerialisedData,
  isAesTokenised,
  parseAes,
} from "@lindorm/aes";

// Type guard — record with Buffer values
isAesBufferData(data); // data is AesDecryptionRecord

// Type guard — record with string values
isAesSerialisedData(data); // data is SerialisedAesDecryption

// Format check — tokenised string
isAesTokenised(str); // boolean

// Parse any format → AesDecryptionRecord
const record = parseAes(anyEncryptedData);
```

---

## Error handling

```ts
import { AesError } from "@lindorm/aes";

try {
  aes.decrypt(corruptedData);
} catch (error) {
  if (error instanceof AesError) {
    console.error("AES operation failed:", error.message);
  }
}
```

`AesError` extends `LindormError` from `@lindorm/errors`.

---

## Testing helpers

A mock factory is exported for unit tests:

```ts
import { createMockAesKit } from "@lindorm/aes";

const mock = createMockAesKit();
// mock.encrypt, mock.decrypt, mock.verify, mock.assert — all jest.fn()
```

---

## License

AGPL-3.0-or-later
