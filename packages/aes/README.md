# @lindorm/aes

A comprehensive TypeScript library for AES encryption and decryption with support for multiple key algorithms, encryption modes, and flexible output formats.

## Installation

```bash
npm install @lindorm/aes
```

## Features

- **Multiple Key Algorithms**: Support for EC, OKP, RSA, and symmetric keys
- **Key Derivation**: HKDF, PBKDF2, and direct key usage
- **Key Wrapping**: ECB and GCM key wrapping modes
- **Multiple Encryption Modes**: CBC-HMAC and GCM authenticated encryption
- **Flexible Output Formats**: Encoded strings, structured records, serialized objects, and tokenized strings
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Content Type Detection**: Automatic detection and handling of different data types
- **Verification Methods**: Built-in verification and assertion utilities

## Supported Algorithms

### Key Algorithms
- **ECDH-ES**: Elliptic Curve Diffie-Hellman Ephemeral Static
- **ECDH-ES+A128KW**: ECDH-ES with AES-128 Key Wrap
- **ECDH-ES+A128GCMKW**: ECDH-ES with AES-128 GCM Key Wrap
- **A128KW**: AES-128 Key Wrap
- **A128GCMKW**: AES-128 GCM Key Wrap
- **PBES2-HS256+A128KW**: PBKDF2 with HMAC SHA-256 and AES-128 Key Wrap
- **RSA-OAEP-256**: RSA OAEP with SHA-256

### Encryption Modes
- **A128CBC-HS256**: AES-128 CBC with HMAC SHA-256
- **A128GCM**: AES-128 GCM (default)
- **A192GCM**: AES-192 GCM
- **A256GCM**: AES-256 GCM

## Basic Usage

### Setup

```typescript
import { AesKit } from '@lindorm/aes';
import { KryptosKit } from '@lindorm/kryptos';

// Generate or load a cryptographic key
const kryptos = KryptosKit.generate.auto({ algorithm: 'ECDH-ES' });

// Create AES kit instance
const aesKit = new AesKit({
  kryptos,
  encryption: 'A256GCM' // Optional: defaults to A256GCM or kryptos.encryption
});
```

### Encryption Modes

The AES kit supports four different output formats:

#### 1. Encoded (Default)
Returns a base64-encoded string - simplest format for storage/transmission:

```typescript
const encrypted = aesKit.encrypt('Hello World'); // Returns base64 string
const decrypted = aesKit.decrypt(encrypted); // 'Hello World'
```

#### 2. Record
Returns a structured object with Buffer values - useful for direct manipulation:

```typescript
const encrypted = aesKit.encrypt('Hello World', 'record');
// Returns: AesEncryptionRecord with Buffer properties

console.log(encrypted.keyId); // Key identifier
console.log(encrypted.algorithm); // 'ECDH-ES'
console.log(encrypted.encryption); // 'A256GCM'
console.log(encrypted.content); // Buffer containing encrypted data

const decrypted = aesKit.decrypt(encrypted); // 'Hello World'
```

#### 3. Serialised
Returns a structured object with string values - JSON-serializable:

```typescript
const encrypted = aesKit.encrypt('Hello World', 'serialised');
// Returns: SerialisedAesEncryption with base64 string properties

const json = JSON.stringify(encrypted); // Can be serialized
const parsed = JSON.parse(json);
const decrypted = aesKit.decrypt(parsed); // 'Hello World'
```

#### 4. Tokenised
Returns a compact token format with embedded metadata:

```typescript
const encrypted = aesKit.encrypt('Hello World', 'tokenised');
// Returns: '$A256GCM$v=1&alg=ECDH-ES&...$base64content$'

const decrypted = aesKit.decrypt(encrypted); // 'Hello World'
```

### Content Types

The library automatically handles different content types:

```typescript
// String content
const text = aesKit.encrypt('Hello World');

// JSON objects
const obj = aesKit.encrypt({ message: 'Hello', count: 42 });

// Arrays
const arr = aesKit.encrypt([1, 2, 3]);

// Buffers
const buf = aesKit.encrypt(Buffer.from('binary data'));

// Numbers
const num = aesKit.encrypt(42);
```

### Verification and Assertion

```typescript
const encrypted = aesKit.encrypt('Hello World');

// Verify without throwing
const isValid = aesKit.verify('Hello World', encrypted); // true
const isInvalid = aesKit.verify('Wrong data', encrypted); // false

// Assert with exception on failure
aesKit.assert('Hello World', encrypted); // Passes
aesKit.assert('Wrong data', encrypted); // Throws AesError
```

## Advanced Usage

### Custom Encryption Configuration

```typescript
import { AesKit } from '@lindorm/aes';
import { KryptosKit } from '@lindorm/kryptos';

// RSA with OAEP padding
const rsaKey = KryptosKit.generate.rsa({ 
  algorithm: 'RSA-OAEP-256',
  modulusLength: 2048 
});

const aesKit = new AesKit({
  kryptos: rsaKey,
  encryption: 'A256GCM'
});

// PBKDF2-based key derivation
const pbkdfKey = KryptosKit.generate.oct({ 
  algorithm: 'PBES2-HS256+A128KW',
  length: 256 
});

const pbkdfAes = new AesKit({
  kryptos: pbkdfKey,
  encryption: 'A128CBC-HS256'
});
```

### Working with Different Key Types

```typescript
// Elliptic Curve keys
const ecKey = KryptosKit.generate.ec({
  algorithm: 'ECDH-ES+A128GCMKW',
  curve: 'P-256'
});

// Edwards Curve keys (OKP)
const okpKey = KryptosKit.generate.okp({
  algorithm: 'ECDH-ES',
  curve: 'X25519'
});

// Symmetric keys
const symmetricKey = KryptosKit.generate.oct({
  algorithm: 'A128GCMKW',
  length: 256
});
```

### Utility Functions

```typescript
import { parseAes, isAesTokenised } from '@lindorm/aes';

// Parse any AES format to standard record
const record = parseAes(encryptedData); // Works with any format

// Check if string is tokenised format
const isToken = isAesTokenised('$A256GCM$v=1&alg=ECDH-ES$...$'); // true
const isNotToken = isAesTokenised('base64string'); // false
```

## Type Definitions

### Core Types

```typescript
interface AesKitOptions {
  kryptos: IKryptos;           // Cryptographic key instance
  encryption?: KryptosEncryption; // Encryption mode (defaults to A256GCM)
}

type AesContent = Array<any> | Buffer | Dict | number | string;

type AesEncryptionMode = 'encoded' | 'record' | 'serialised' | 'tokenised';
```

### Record Types

```typescript
interface AesEncryptionRecord {
  algorithm: KryptosAlgorithm;          // Key algorithm used
  authTag: Buffer;                      // Authentication tag
  content: Buffer;                      // Encrypted content
  contentType: AesContentType;          // Original content type
  encryption: KryptosEncryption;        // Encryption mode
  hkdfSalt?: Buffer;                    // HKDF salt (if applicable)
  initialisationVector: Buffer;         // IV for encryption
  keyId: string;                        // Key identifier
  pbkdfIterations?: number;             // PBKDF2 iterations (if applicable)
  pbkdfSalt?: Buffer;                   // PBKDF2 salt (if applicable)
  publicEncryptionJwk?: PublicEncryptionJwk; // Public key (for ECDH)
  version: number;                      // Format version
}

interface SerialisedAesEncryption {
  // Same as AesEncryptionRecord but with base64 strings instead of Buffers
}
```

## Error Handling

```typescript
import { AesError } from '@lindorm/aes';

try {
  const decrypted = aesKit.decrypt(invalidData);
} catch (error) {
  if (error instanceof AesError) {
    console.log('AES operation failed:', error.message);
  }
}
```

## Integration with Kryptos

The AES library integrates seamlessly with `@lindorm/kryptos` for key management:

```typescript
import { AesKit } from '@lindorm/aes';
import { Amphora } from '@lindorm/amphora';

// Use with key storage
const amphora = new Amphora({ domain: 'https://example.com', logger });
await amphora.setup();

// Find encryption key
const kryptos = await amphora.find({ use: 'enc', algorithm: 'ECDH-ES' });

const aesKit = new AesKit({ kryptos });
```

## Performance Considerations

- **Encoded mode**: Fastest for simple use cases
- **Record mode**: Best for direct Buffer manipulation
- **Serialised mode**: Optimal for JSON storage/transmission
- **Tokenised mode**: Most compact for URL-safe tokens

## License

AGPL-3.0-or-later