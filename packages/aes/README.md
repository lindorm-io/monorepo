# @lindorm/aes

High-level AES encryption and decryption for Node.js with first-class TypeScript support. `@lindorm/aes` wraps key derivation, key wrapping, and authenticated content encryption behind a single `AesKit` class — encrypt any supported value in one call and get back a string, a structured record, or a compact token.

## Features

- `AesKit` — `encrypt` / `decrypt` / `verify` / `assert` in four output formats: `encoded`, `record`, `serialised`, `tokenised`
- Content encryption with `A128GCM`, `A192GCM`, `A256GCM`, `A128CBC-HS256`, `A192CBC-HS384`, `A256CBC-HS512`
- Key management for the ECDH-ES family, RSA-OAEP family, AES-KW, AES-GCM-KW, PBES2, and `dir`
- Automatic content-type detection for strings, `Buffer`, objects, arrays, numbers, and booleans — original type is preserved on decrypt
- Unified header model with format-derived AAD across the string and serialised formats
- Static helpers for content-type detection, format detection, and parsing
- Two-step `prepareEncryption()` flow for advanced JWE-style encryption
- ESM-only

## Installation

```bash
npm install @lindorm/aes
```

This package is ESM-only and is published as `"type": "module"`. All examples use `import`.

## Quick start

```ts
import { AesKit } from "@lindorm/aes";
import { KryptosKit } from "@lindorm/kryptos";

const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A256KW" });
const aes = new AesKit({ kryptos });

const encrypted = aes.encrypt("Hello World"); // base64url string
const decrypted = aes.decrypt(encrypted); // "Hello World"
```

### Output formats

`encrypt` returns a different shape depending on the `mode` argument:

```ts
const encoded = aes.encrypt("secret"); // string (default: "encoded")
const record = aes.encrypt("secret", "record"); // AesEncryptionRecord
const serialised = aes.encrypt("secret", "serialised"); // SerialisedAesEncryption
const tokenised = aes.encrypt("secret", "tokenised"); // "aes:<header>$..."
```

All four formats are accepted by `decrypt`, `verify`, and `assert`:

```ts
aes.decrypt(encoded);
aes.decrypt(record);
aes.decrypt(serialised);
aes.decrypt(tokenised);
```

### Encrypt any supported content

```ts
aes.encrypt("plain text"); // string
aes.encrypt(Buffer.from("binary")); // Buffer
aes.encrypt({ user: "alice", role: "admin" }); // object
aes.encrypt([1, 2, 3]); // array
aes.encrypt(42); // number
aes.encrypt(true); // boolean

const obj = aes.decrypt<{ user: string }>(cipher); // typed return
```

### Verify and assert

```ts
const cipher = aes.encrypt("secret");

aes.verify("secret", cipher); // true
aes.verify("wrong", cipher); // false — never throws

aes.assert("secret", cipher); // void — passes silently
aes.assert("wrong", cipher); // throws AesError("Invalid AES cipher")
```

### Additional Authenticated Data (AAD)

The `encoded`, `serialised`, and `tokenised` formats automatically derive AAD from their base64url-encoded header — metadata integrity is bound to the ciphertext for free.

For raw `record`-mode payloads with no header, you can supply AAD on decrypt through `options.aad`:

```ts
const record = aes.encrypt("payload", "record");
const aad = Buffer.from("request-id:abc-123");

aes.decrypt({ ...record, aad }); // pass AAD through the record
aes.decrypt(record, { aad }); // or via the options argument
```

To encrypt with caller-controlled AAD use the two-step `prepareEncryption()` flow described in the API reference.

## API reference

### `new AesKit(options)`

```ts
new AesKit({ kryptos, encryption });
```

| Option       | Type                 | Description                                                                       |
| ------------ | -------------------- | --------------------------------------------------------------------------------- |
| `kryptos`    | `IKryptos`           | Required. The `@lindorm/kryptos` key instance used for key derivation / wrapping. |
| `encryption` | `KryptosEncryption?` | Optional. Falls back to `kryptos.encryption`, then to `"A256GCM"`.                |

`aes.kryptos` is exposed as a public readonly property.

### `aes.encrypt(data, mode?)`

```ts
encrypt(data: AesContent, mode?: "encoded"): string;
encrypt(data: AesContent, mode: "record"): AesEncryptionRecord;
encrypt(data: AesContent, mode: "serialised"): SerialisedAesEncryption;
encrypt(data: AesContent, mode: "tokenised"): string;
```

Encrypts and returns one of four shapes. `mode` defaults to `"encoded"`.

### `aes.decrypt<T>(data, options?)`

```ts
decrypt<T extends AesContent = string>(
  data: AesDecryptionRecord | SerialisedAesDecryption | string,
  options?: AesOperationOptions,
): T;
```

Auto-detects the input format. AAD is taken from the parsed input when present and otherwise from `options.aad`.

### `aes.verify(input, data, options?)`

```ts
verify(
  input: AesContent,
  data: AesDecryptionRecord | SerialisedAesDecryption | string,
  options?: AesOperationOptions,
): boolean;
```

Returns `true` if the decrypted payload deeply equals `input`, `false` otherwise. Never throws.

### `aes.assert(input, data, options?)`

```ts
assert(
  input: AesContent,
  data: AesDecryptionRecord | SerialisedAesDecryption | string,
  options?: AesOperationOptions,
): void;
```

Throws `AesError("Invalid AES cipher")` when the decrypted payload does not match `input`.

### `aes.prepareEncryption()`

Two-step encryption flow that splits key management from content encryption. Returns header parameters, the wrapped CEK (when applicable), and an `encrypt` closure that accepts plaintext (and optional `aad`).

```ts
const prepared = aes.prepareEncryption();

const result = prepared.encrypt("payload", { aad: Buffer.from("ctx") });
// result: { authTag, content, contentType, initialisationVector }

// prepared.headerParams: { publicEncryptionJwk?, pbkdfIterations?, pbkdfSalt?,
//   publicEncryptionIv?, publicEncryptionTag? }
// prepared.publicEncryptionKey: Buffer | undefined
```

### Static methods

```ts
AesKit.contentType("hello"); // "text/plain"
AesKit.contentType(Buffer.from("data")); // "application/octet-stream"
AesKit.contentType({ a: 1 }); // "application/json"

AesKit.isAesTokenised("aes:..."); // true
AesKit.isAesTokenised("base64string"); // false

AesKit.parse(encodedString); // ParsedAesDecryptionRecord
AesKit.parse(serialisedObject); // ParsedAesDecryptionRecord
AesKit.parse(decryptionRecord); // AesDecryptionRecord (returned as-is)
```

### Top-level utilities

```ts
import {
  isAesBufferData,
  isAesSerialisedData,
  isAesTokenised,
  parseAes,
} from "@lindorm/aes";

isAesBufferData(value); // value is AesDecryptionRecord
isAesSerialisedData(value); // value is SerialisedAesDecryption
isAesTokenised(value); // value starts with "aes:"
parseAes(input); // any → AesDecryptionRecord
```

## Format reference

All output formats share a unified header — a JSON object containing the algorithm, encryption, content type, key id, version, and any key-exchange parameters.

### Header structure

```ts
type AesHeader = {
  alg: KryptosAlgorithm; // key management algorithm
  cty: AesContentType; // content type
  enc: KryptosEncryption; // content encryption
  epk?: PublicEncryptionJwk; // ephemeral public key (ECDH)
  iv?: string; // public encryption IV (base64url, GCMKW)
  kid: string; // key id
  p2c?: number; // PBKDF2 iteration count
  p2s?: string; // PBKDF2 salt (base64url)
  tag?: string; // public encryption tag (base64url, GCMKW)
  v: string; // format version
};
```

### Encoded

A single base64url string. Binary layout:

```
[2B header length][header JSON][2B CEK length][CEK][IV][Tag][Ciphertext]
```

IV and tag sizes follow the encryption algorithm.

### Serialised

JSON-safe object with base64url-encoded fields:

```ts
type SerialisedAesEncryption = {
  cek: string | undefined;
  ciphertext: string;
  header: string; // base64url(JSON(header))
  iv: string;
  tag: string;
  v: string;
};
```

### Tokenised

A `$`-delimited string prefixed with `aes:`:

```
aes:<header>$[<cek>$]<iv>$<tag>$<ciphertext>
```

All segments are base64url-encoded. The CEK segment is omitted for `dir` and `ECDH-ES`.

### Record

A plain object with raw `Buffer` values for binary fields. Useful when you need programmatic access to individual encryption components.

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
  version: string;
};
```

`AesDecryptionRecord` mirrors `AesEncryptionRecord` plus an optional `aad?: Buffer`. `ParsedAesDecryptionRecord` is the variant returned by string / serialised parsers and guarantees `aad: Buffer` is set.

`SerialisedAesDecryption` mirrors `SerialisedAesEncryption` with `cek?: string` optional.

## Type reference

```ts
type AesContent = Array<any> | boolean | Buffer | Dict | number | string;

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

## Error handling

```ts
import { AesError } from "@lindorm/aes";

try {
  aes.decrypt(corruptedData);
} catch (error) {
  if (error instanceof AesError) {
    // ...
  }
}
```

`AesError` extends `LindormError`.

## Testing helpers

`@lindorm/aes` ships separate mock entrypoints for Jest and Vitest. Both export `createMockAesKit()`, which returns an `IAesKit` whose methods are spies backed by the corresponding test framework.

```ts
// vitest
import { createMockAesKit } from "@lindorm/aes/mocks/vitest";

const aes = createMockAesKit();
aes.encrypt("hello"); // spied — has a default base64url encode implementation
aes.decrypt(token); // spied — base64url decode (handles "aes:" prefix)
aes.verify(input, data); // spied — returns true by default
aes.assert(input, data); // spied — no-op by default
```

```ts
// jest
import { createMockAesKit } from "@lindorm/aes/mocks/jest";
```

The mock includes a `kryptos` instance built from the corresponding `@lindorm/kryptos` mock.

## License

AGPL-3.0-or-later
