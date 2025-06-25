# @lindorm/ec

Elliptic Curve cryptography utilities for digital signatures using ECDSA algorithms.

## Installation

```bash
npm install @lindorm/ec
```

## Features

- **ECDSA Digital Signatures**: Sign and verify data using elliptic curve algorithms
- **Multiple Algorithms**: Support for ES256, ES384, and ES512
- **Flexible Encoding**: Multiple encoding options (base64, base64url, hex)
- **DSA Format Options**: Support for DER and IEEE-P1363 encoding
- **Raw Signature Format**: Convert between DER and raw signature formats
- **Type-Safe**: Full TypeScript support with strict typing
- **Error Handling**: Comprehensive error messages for debugging

## Quick Start

```typescript
import { EcKit } from "@lindorm/ec";
import { KryptosEc } from "@lindorm/kryptos";

// Create an EC key pair
const kryptos = KryptosEc.fromB64({
  algorithm: "ES256",
  // ... your key data
});

// Initialize EcKit
const ecKit = new EcKit({ kryptos });

// Sign data
const data = Buffer.from("Hello World");
const signature = ecKit.sign(data);

// Verify signature
const isValid = ecKit.verify(data, signature); // true

// Assert signature (throws if invalid)
ecKit.assert(data, signature);
```

## API Reference

### EcKit Class

The main class for elliptic curve operations.

#### Constructor Options

```typescript
interface EcKitOptions {
  kryptos: IKryptosEc;          // EC key pair from @lindorm/kryptos
  dsa?: "der" | "ieee-p1363";  // DSA encoding format (default: "der")
  encoding?: BufferEncoding;     // Output encoding (default: "base64")
  raw?: boolean;                // Use raw signature format (default: false)
}
```

#### Methods

##### `sign(data: KeyData): Buffer`
Signs the provided data and returns the signature as a Buffer.

```typescript
const signature = ecKit.sign("data to sign");
const signature2 = ecKit.sign(Buffer.from("data"));
```

##### `verify(data: KeyData, signature: KeyData): boolean`
Verifies a signature against the provided data.

```typescript
const isValid = ecKit.verify("data", signature);
console.log(isValid); // true or false
```

##### `assert(data: KeyData, signature: KeyData): void`
Verifies a signature and throws an error if invalid.

```typescript
try {
  ecKit.assert("data", signature);
  // Signature is valid
} catch (error) {
  // Signature is invalid
}
```

##### `format(data: Buffer): string`
Formats a Buffer to string using the configured encoding.

```typescript
const formatted = ecKit.format(signature);
// Returns base64/base64url/hex string based on configuration
```

## Supported Algorithms

| Algorithm | Curve | Hash Function | Key Size |
|-----------|-------|---------------|----------|
| ES256 | P-256 | SHA-256 | 256 bits |
| ES384 | P-384 | SHA-384 | 384 bits |
| ES512 | P-521 | SHA-512 | 521 bits |

## Encoding Options

### DSA Encoding Formats

- **DER** (Distinguished Encoding Rules): Standard format used in X.509 certificates
- **IEEE-P1363**: Alternative format used in some cryptographic protocols

```typescript
// Using DER format (default)
const ecKit = new EcKit({ 
  kryptos,
  dsa: "der"
});

// Using IEEE-P1363 format
const ecKit2 = new EcKit({ 
  kryptos,
  dsa: "ieee-p1363"
});
```

### Output Encoding

```typescript
// Base64 encoding (default)
const ecKit = new EcKit({ 
  kryptos,
  encoding: "base64"
});

// Base64URL encoding (URL-safe)
const ecKit2 = new EcKit({ 
  kryptos,
  encoding: "base64url"
});

// Hexadecimal encoding
const ecKit3 = new EcKit({ 
  kryptos,
  encoding: "hex"
});
```

### Raw Signature Format

The raw format concatenates the r and s values directly, which is useful for JWT/JWS compatibility.

```typescript
// Standard DER format
const ecKit = new EcKit({ 
  kryptos,
  raw: false // default
});

// Raw format (r || s concatenation)
const ecKitRaw = new EcKit({ 
  kryptos,
  raw: true
});
```

## Advanced Usage

### Working with Different Data Types

```typescript
// String data with encoding
const signature1 = ecKit.sign("Hello World");

// Buffer data
const buffer = Buffer.from("Hello World", "utf-8");
const signature2 = ecKit.sign(buffer);

// Base64 encoded data
const base64Data = Buffer.from("Hello World").toString("base64");
const signature3 = ecKit.sign(base64Data);
```

### JWT/JWS Integration

```typescript
// For JWT/JWS, use raw format with base64url encoding
const jwtEcKit = new EcKit({
  kryptos,
  encoding: "base64url",
  raw: true
});

// Sign JWT payload
const payload = Buffer.from(JSON.stringify({ sub: "1234567890" }));
const signature = jwtEcKit.sign(payload);
const signatureString = jwtEcKit.format(signature);
```

### Signature Format Conversion

```typescript
// Convert between DER and raw formats
const derEcKit = new EcKit({ kryptos, raw: false });
const rawEcKit = new EcKit({ kryptos, raw: true });

// Sign with DER format
const derSignature = derEcKit.sign("data");

// Verify with raw format (automatic conversion)
const isValid = rawEcKit.verify("data", derSignature);
```

### Error Handling

```typescript
import { EcError } from "@lindorm/ec";

try {
  // Missing private key for signing
  const verifyOnlyKryptos = KryptosEc.fromB64({ 
    publicKey: "...",
    algorithm: "ES256"
  });
  const ecKit = new EcKit({ kryptos: verifyOnlyKryptos });
  ecKit.sign("data"); // Throws EcError
} catch (error) {
  if (error instanceof EcError) {
    console.error("EC operation failed:", error.message);
  }
}
```

## Examples

### Creating a Signing Service

```typescript
import { EcKit } from "@lindorm/ec";
import { KryptosEc } from "@lindorm/kryptos";

class SigningService {
  private ecKit: EcKit;

  constructor(privateKey: string, algorithm: "ES256" | "ES384" | "ES512") {
    const kryptos = KryptosEc.fromB64({
      privateKey,
      algorithm
    });
    
    this.ecKit = new EcKit({
      kryptos,
      encoding: "base64url",
      raw: true // For JWT compatibility
    });
  }

  signPayload(payload: object): string {
    const data = Buffer.from(JSON.stringify(payload));
    const signature = this.ecKit.sign(data);
    return this.ecKit.format(signature);
  }

  verifyPayload(payload: object, signature: string): boolean {
    const data = Buffer.from(JSON.stringify(payload));
    return this.ecKit.verify(data, signature);
  }
}
```

### Verification Service with Public Key

```typescript
class VerificationService {
  private ecKit: EcKit;

  constructor(publicKey: string, algorithm: "ES256" | "ES384" | "ES512") {
    const kryptos = KryptosEc.fromB64({
      publicKey,
      algorithm
    });
    
    this.ecKit = new EcKit({
      kryptos,
      encoding: "base64url",
      raw: true
    });
  }

  verifySignature(data: string, signature: string): boolean {
    try {
      this.ecKit.assert(data, signature);
      return true;
    } catch {
      return false;
    }
  }
}
```

### Document Signing System

```typescript
interface SignedDocument {
  content: string;
  signature: string;
  algorithm: string;
  timestamp: number;
}

class DocumentSigner {
  private ecKit: EcKit;
  private algorithm: string;

  constructor(kryptos: IKryptosEc) {
    this.ecKit = new EcKit({ 
      kryptos,
      encoding: "base64"
    });
    this.algorithm = kryptos.algorithm;
  }

  signDocument(content: string): SignedDocument {
    const timestamp = Date.now();
    const dataToSign = `${content}|${timestamp}`;
    const signature = this.ecKit.sign(dataToSign);
    
    return {
      content,
      signature: this.ecKit.format(signature),
      algorithm: this.algorithm,
      timestamp
    };
  }

  verifyDocument(doc: SignedDocument): boolean {
    const dataToVerify = `${doc.content}|${doc.timestamp}`;
    return this.ecKit.verify(dataToVerify, doc.signature);
  }
}
```

## Type Definitions

### KeyData Type

Input data can be provided in multiple formats:

```typescript
type KeyData = Buffer | string;
```

### IKryptosEc Interface

The EC key pair interface from `@lindorm/kryptos`:

```typescript
interface IKryptosEc {
  algorithm: "ES256" | "ES384" | "ES512";
  privateKey?: string;
  publicKey?: string;
  // ... other properties
}
```

## Error Handling

The package throws `EcError` for various error conditions:

- Missing private key when attempting to sign
- Missing public key when attempting to verify
- Invalid signature during assertion
- Unsupported EC algorithm
- Invalid key format

```typescript
import { EcError } from "@lindorm/ec";

try {
  ecKit.assert(data, invalidSignature);
} catch (error) {
  if (error instanceof EcError) {
    console.error("Signature verification failed:", error.message);
  }
}
```

## Security Considerations

- Always use secure random number generation for key creation
- Protect private keys appropriately
- Use appropriate key sizes (ES256 minimum for most applications)
- Verify signatures before trusting data
- Consider using ES384 or ES512 for higher security requirements

## License

AGPL-3.0-or-later
