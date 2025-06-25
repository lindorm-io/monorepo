# @lindorm/aegis

A comprehensive TypeScript library for JWT, JWE, JWS, CBOR Web Token (CWT), COSE Sign (CWS), and COSE Encrypt (CWE) operations with cryptographic key management integration.

## Installation

```bash
npm install @lindorm/aegis
```

## Features

- **JWT Operations**: Sign and verify JSON Web Tokens
- **JWE Operations**: Encrypt and decrypt JSON Web Encryption
- **JWS Operations**: Sign and verify JSON Web Signatures
- **CWT Operations**: Sign and verify CBOR Web Tokens
- **CWS Operations**: Sign and verify COSE Sign messages
- **CWE Operations**: Encrypt and decrypt COSE Encrypt messages
- **AES Operations**: AES encryption and decryption with multiple output formats
- **Static Token Analysis**: Decode, parse, and validate tokens without verification
- **Universal Verification**: Automatically detect and verify any supported token type

## Basic Usage

### Setup

```typescript
import { Aegis } from '@lindorm/aegis';
import { Amphora } from '@lindorm/amphora';
import { Logger } from '@lindorm/logger';

const logger = new Logger();
const amphora = new Amphora({ domain: 'https://example.com', logger });

const aegis = new Aegis({
  amphora,
  logger,
  issuer: 'https://example.com', // Optional: defaults to amphora.domain
  clockTolerance: 30000, // Optional: 30 seconds tolerance for time-based claims
});

// Setup and add keys to amphora
await amphora.setup();
// amphora.add(kryptosKey);
```

### JWT Operations

```typescript
// Sign a JWT
const signedJwt = await aegis.jwt.sign({
  expires: '1h',
  subject: 'user123',
  tokenType: 'access_token',
  claims: { name: 'John Doe', admin: true },
  audience: ['https://api.example.com'],
  scope: ['read', 'write']
});

// Verify a JWT
const parsedJwt = await aegis.jwt.verify(signedJwt.token, {
  audience: 'https://api.example.com',
  scope: ['read']
});
```

### JWE Operations

```typescript
// Encrypt data with JWE
const encryptedJwe = await aegis.jwe.encrypt('sensitive data', {
  objectId: 'message-123'
});

// Decrypt JWE
const decryptedJwe = await aegis.jwe.decrypt(encryptedJwe.token);
console.log(decryptedJwe.payload); // 'sensitive data'
```

### JWS Operations

```typescript
// Sign arbitrary data with JWS
const signedJws = await aegis.jws.sign('Hello World', {
  objectId: 'message-456'
});

// Verify JWS
const parsedJws = await aegis.jws.verify(signedJws.token);
console.log(parsedJws.payload); // 'Hello World'
```

### CBOR Web Token (CWT) Operations

```typescript
// Sign a CWT (CBOR Web Token)
const signedCwt = await aegis.cwt.sign({
  expires: '2h',
  subject: 'user123',
  tokenType: 'access_token',
  audience: ['api.example.com']
});

// Verify CWT
const parsedCwt = await aegis.cwt.verify(signedCwt.token);
```

### COSE Operations

```typescript
// COSE Encrypt (CWE)
const encryptedCwe = await aegis.cwe.encrypt('secret message', {
  objectId: 'message-123'
});

const decryptedCwe = await aegis.cwe.decrypt(encryptedCwe.token);
console.log(decryptedCwe.payload); // 'secret message'

// COSE Sign (CWS)
const signedCws = await aegis.cws.sign('important info', {
  objectId: 'message-789'
});
const parsedCws = await aegis.cws.verify(signedCws.token);
console.log(parsedCws.payload); // 'important info'
```

### AES Operations

```typescript
// AES encryption with different output formats
const encoded = await aegis.aes.encrypt('data'); // Returns base64 encoded string
const record = await aegis.aes.encrypt('data', 'record'); // Returns AesEncryptionRecord
const serialised = await aegis.aes.encrypt('data', 'serialised'); // Returns SerialisedAesEncryption

// AES decryption (accepts any format)
const decrypted = await aegis.aes.decrypt(encoded);
```

### Universal Token Verification

```typescript
// Automatically detect and verify any supported token type
const result = await aegis.verify(anyTokenString, {
  // Optional verification options (same as JWT/CWT verify options)
  audience: 'https://api.example.com'
});

// Works with JWT, JWE, JWS, CWT, CWE, or CWS tokens
// JWE and CWE are automatically decrypted and their inner payload is verified
```

## Static Methods

Aegis provides static methods for token analysis without requiring cryptographic verification:

```typescript
// Check token type
const isJwt = Aegis.isJwt(token);
const isJwe = Aegis.isJwe(token);
const isCwt = Aegis.isCwt(token);

// Decode tokens (header + payload, no verification)
const decoded = Aegis.decode(token);

// Parse tokens (decode + basic validation, no signature verification)
const parsed = Aegis.parse(token);

// Extract header information
const header = Aegis.header(token);
```

## Configuration Options

### AegisOptions

```typescript
interface AegisOptions {
  amphora: IAmphora;           // Key storage and management
  logger: ILogger;             // Logger instance
  issuer?: string;             // Token issuer (defaults to amphora.domain)
  clockTolerance?: number;     // Time tolerance in milliseconds (default: 0)
  encAlgorithm?: KryptosEncAlgorithm;  // Default encryption algorithm
  encryption?: KryptosEncryption;      // Default encryption method (default: 'A256GCM')
  sigAlgorithm?: KryptosSigAlgorithm;  // Default signing algorithm
}
```

### Signing Options

```typescript
interface SignJwtContent {
  expires: string;            // Required: Expiration time ('1h', '30m', etc.)
  subject: string;            // Required: Token subject
  tokenType: string;          // Required: Type of token
  audience?: string[];        // Token audiences
  scope?: string[];           // OAuth scopes
  claims?: Record<string, any>; // Additional claims
  permissions?: string[];     // User permissions
  roles?: string[];           // User roles
  // ... many other optional fields
}

interface SignJwtOptions {
  objectId?: string;          // Object identifier
  tokenId?: string;           // Token identifier
  issuedAt?: Date;           // Issue time (defaults to now)
  // ... other header options
}
```

### Verification Options

```typescript
interface VerifyJwtOptions {
  audience?: string | string[] | Operators;    // Required audience(s)
  scope?: string | string[] | Operators;       // Required scope(s)
  subject?: string | string[] | Operators;     // Expected subject(s)
  issuer?: string | Operators;                 // Expected issuer
  tokenType?: string | Operators;              // Expected token type
  clientId?: string | string[] | Operators;    // Expected client ID
  permissions?: string | string[] | Operators; // Required permissions
  roles?: string | string[] | Operators;       // Required roles
  // ... many other optional verification fields with Operators support
}
```

## Error Handling

The package provides specific error types for different scenarios:

```typescript
import { 
  AegisError,
  JwtError,
  JweError,
  JwsError,
  CwtError,
  CoseEncryptError,
  CoseSignError
} from '@lindorm/aegis';

try {
  const result = await aegis.jwt.verify(token);
} catch (error) {
  if (error instanceof JwtError) {
    console.log('JWT-specific error:', error.message);
  } else if (error instanceof AegisError) {
    console.log('General Aegis error:', error.message);
  }
}
```

## Key Management Integration

Aegis integrates with `@lindorm/amphora` for cryptographic key management and `@lindorm/kryptos` for key operations. Keys must be properly configured in the amphora instance with appropriate purposes and operations:

- **Encryption keys**: Purpose `enc`, operations `['encrypt', 'deriveKey', 'wrapKey', 'decrypt', 'unwrapKey']`
- **Signing keys**: Purpose `sig`, operations `['sign', 'verify']`

## License

AGPL-3.0-or-later
