# @lindorm/amphora

A comprehensive TypeScript library for cryptographic key storage, management, and discovery. Amphora provides a centralized vault for managing Kryptos keys with support for external OpenID Connect providers and automatic key discovery.

## Installation

```bash
npm install @lindorm/amphora
```

## Features

- **Key Vault Management**: Store and manage multiple cryptographic keys
- **External Provider Integration**: Automatic discovery of keys from OpenID Connect providers
- **Key Filtering and Queries**: Advanced MongoDB-style querying for key discovery
- **JWKS Generation**: Automatic generation of JSON Web Key Sets for public distribution
- **Environment Import**: Load keys from environment variables
- **Capability Checking**: Verify encryption, decryption, signing, and verification capabilities
- **Automatic Refresh**: Dynamic key discovery and refresh from external sources
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Basic Usage

### Setup

```typescript
import { Amphora } from '@lindorm/amphora';
import { createLogger } from '@lindorm/logger';
import { KryptosKit } from '@lindorm/kryptos';

const logger = createLogger();
const amphora = new Amphora({
  domain: 'https://api.example.com',
  logger
});

// Setup external providers (optional)
await amphora.setup();
```

### Adding Keys

```typescript
// Generate and add a signing key
const signingKey = KryptosKit.generate.ec({
  algorithm: 'ES256',
  curve: 'P-256',
  use: 'sig'
});

amphora.add(signingKey);

// Add multiple keys at once
const encryptionKey = KryptosKit.generate.okp({
  algorithm: 'ECDH-ES',
  curve: 'X25519',
  use: 'enc'
});

amphora.add([signingKey, encryptionKey]);

// Keys are automatically deduplicated by ID
amphora.add([signingKey, signingKey]); // Only one copy is stored
```

### Environment Variable Import

```typescript
// Load keys from environment variables (kryptos: prefix)
amphora.env([
  'kryptos:eyJlbmMiOiJBMTkyR0NNIiwiaWF0IjoxNzQ0NzA0MjYz...',
  'kryptos:eyJpYXQiOjE3NDQ3MDQyMjgsImtleV9vcHMiOlsic2lnbiI...'
]);

// Or single key
amphora.env('kryptos:eyJlbmMiOiJBMTkyR0NNIiwiaWF0IjoxNzQ0NzA0MjYz...');
```

### Finding Keys

```typescript
// Find a specific key by ID
const key = await amphora.find({
  issuer: 'https://api.example.com',
  id: 'key-id-here'
});

// Find keys by criteria
const signingKeys = await amphora.filter({
  issuer: 'https://api.example.com',
  use: 'sig',
  hasPrivateKey: true
});

// Synchronous operations (only searches local vault)
const localKey = amphora.findSync({ id: 'key-id' });
const localKeys = amphora.filterSync({ use: 'enc' });
```

### Advanced Querying

Amphora supports MongoDB-style queries using predicates:

```typescript
// Find keys that can encrypt OR derive keys
const encryptionKeys = await amphora.filter({
  issuer: 'https://api.example.com',
  $or: [
    { operations: ['encrypt'] },
    { operations: ['deriveKey'] },
    { operations: ['wrapKey'] }
  ]
});

// Find EC keys with specific curves
const ecKeys = await amphora.filter({
  type: 'EC',
  curve: { $in: ['P-256', 'P-384'] }
});

// Find active keys (not expired, not before current time)
const activeKeys = await amphora.filter({
  issuer: 'https://api.example.com',
  // Amphora automatically filters out expired keys
});

// Find keys with specific operations
const derivationKeys = await amphora.filter({
  operations: { $in: ['deriveKey'] }
});
```

### Capability Checking

```typescript
// Check what operations the vault can perform
const canEncrypt = amphora.canEncrypt(); // true/false
const canDecrypt = amphora.canDecrypt(); // true/false
const canSign = amphora.canSign(); // true/false
const canVerify = amphora.canVerify(); // true/false

// Use capability checks before operations
if (amphora.canSign()) {
  const signingKey = await amphora.find({ use: 'sig' });
  // Perform signing operation
}
```

### JWKS Generation

```typescript
// Get public keys as JWKS (JSON Web Key Set)
const jwks = amphora.jwks;
// Returns: { keys: [LindormJwk, ...] }

// Serve JWKS at /.well-known/jwks.json
app.get('/.well-known/jwks.json', (req, res) => {
  res.json(amphora.jwks);
});
```

## External Provider Integration

### OpenID Connect Provider Discovery

```typescript
const amphora = new Amphora({
  domain: 'https://api.example.com',
  logger,
  external: [
    // Auto-discover from OpenID configuration
    {
      openIdConfigurationUri: 'https://auth0.example.com/.well-known/openid-configuration'
    },
    
    // Direct JWKS URI
    {
      issuer: 'https://external-api.com',
      jwksUri: 'https://external-api.com/.well-known/jwks.json'
    },
    
    // Auto-discover by issuer (fetches /.well-known/openid-configuration)
    {
      issuer: 'https://another-provider.com'
    }
  ]
});

await amphora.setup(); // Discovers and loads external keys
```

### Manual Refresh

```typescript
// Refresh keys from external providers
await amphora.refresh();

// Keys are automatically refreshed when not found locally
const externalKey = await amphora.find({
  issuer: 'https://external-provider.com',
  id: 'external-key-id'
}); // Triggers refresh if not found locally
```

## Advanced Usage

### Custom Key Operations

```typescript
// Access the vault directly
console.log('Total keys in vault:', amphora.vault.length);

// Access external configuration
console.log('External providers:', amphora.config);

// Filter by specific attributes
const rsaKeys = await amphora.filter({
  type: 'RSA',
  hasPrivateKey: true,
  algorithm: 'RS256'
});

// Find keys by owner
const userKeys = await amphora.filter({
  ownerId: 'user-123',
  purpose: 'authentication'
});
```

### Key Lifecycle Management

```typescript
// Keys are automatically validated when added
try {
  amphora.add(expiredKey); // Throws AmphoraError
} catch (error) {
  console.log('Cannot add expired key');
}

// Keys must have issuer and ID
const key = KryptosKit.generate.ec({ algorithm: 'ES256' });
key.issuer = 'https://api.example.com'; // Required
amphora.add(key);

// JWKS URI is automatically set based on domain
console.log(key.jwksUri); // 'https://api.example.com/.well-known/jwks.json'
```

## Type Definitions

### Core Types

```typescript
interface AmphoraOptions {
  domain?: string;                      // Server domain for key issuing
  external?: AmphoraExternalOption[];   // External provider configurations
  logger: ILogger;                      // Logger instance
}

interface AmphoraExternalOption {
  issuer?: string;                      // Provider issuer
  jwksUri?: string;                     // Direct JWKS endpoint
  openIdConfiguration?: Partial<OpenIdConfiguration>; // Static config
  openIdConfigurationUri?: string;      // Auto-discovery endpoint
}
```

### Query Types

```typescript
type AmphoraQuery = Predicate<{
  id?: string;                    // Key identifier
  algorithm?: string;             // Cryptographic algorithm
  curve?: string;                 // Elliptic curve name
  encryption?: string;            // Encryption algorithm
  hasPrivateKey?: boolean;        // Has private key material
  hasPublicKey?: boolean;         // Has public key material
  isExternal?: boolean;           // Key from external provider
  issuer?: string;                // Key issuer
  operations?: string[];          // Supported operations
  ownerId?: string;               // Key owner identifier
  purpose?: string;               // Key purpose/usage
  type?: 'EC' | 'RSA' | 'oct' | 'OKP'; // Key type
  use?: 'sig' | 'enc';           // Key usage
}>;

// Supports MongoDB-style operators
type Predicate<T> = {
  [K in keyof T]?: T[K] | {
    $in?: T[K][];
    $nin?: T[K][];
    $eq?: T[K];
    $ne?: T[K];
    // ... other operators
  };
} & {
  $or?: Predicate<T>[];
  $and?: Predicate<T>[];
  $nor?: Predicate<T>[];
};
```

### Response Types

```typescript
interface AmphoraJwks {
  keys: LindormJwk[];             // Public keys for distribution
}

interface AmphoraConfig {
  issuer: string;                 // Provider issuer
  jwksUri: string;                // JWKS endpoint
  openIdConfigurationUri?: string; // OpenID configuration endpoint
  // ... other OpenID Connect configuration fields
}
```

## Error Handling

```typescript
import { AmphoraError } from '@lindorm/amphora';

try {
  const key = await amphora.find({ id: 'non-existent' });
} catch (error) {
  if (error instanceof AmphoraError) {
    console.log('Key not found:', error.message);
  }
}

// Common error scenarios:
// - Adding keys without ID or issuer
// - Adding expired keys
// - Accessing JWKS without domain
// - Key not found in vault or external providers
```

## Integration Examples

### With Authentication System

```typescript
import { Amphora } from '@lindorm/amphora';
import { AesKit } from '@lindorm/aes';
import { Aegis } from '@lindorm/aegis';

// Setup key management
const amphora = new Amphora({
  domain: 'https://auth.example.com',
  logger,
  external: [
    { issuer: 'https://external-provider.com' }
  ]
});

await amphora.setup();

// Create token signing system
const aegis = new Aegis({ amphora, logger });

// Issue tokens using managed keys
const token = await aegis.jwt.sign({
  subject: 'user123',
  expires: '1h',
  tokenType: 'access_token'
});

// Verify tokens (automatically discovers external keys if needed)
const verified = await aegis.jwt.verify(externalToken);
```

### With Express.js

```typescript
import express from 'express';

const app = express();

// Serve JWKS endpoint
app.get('/.well-known/jwks.json', (req, res) => {
  res.json(amphora.jwks);
});

// Health check with capability information
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    capabilities: {
      canEncrypt: amphora.canEncrypt(),
      canDecrypt: amphora.canDecrypt(),
      canSign: amphora.canSign(),
      canVerify: amphora.canVerify()
    },
    keyCount: amphora.vault.length
  });
});
```

## Dependencies

- `@lindorm/kryptos` - Cryptographic key operations
- `@lindorm/conduit` - HTTP client for external key discovery
- `@lindorm/utils` - Utility functions including predicate types
- `@lindorm/is` - Type checking utilities
- `@lindorm/errors` - Error handling

## License

AGPL-3.0-or-later