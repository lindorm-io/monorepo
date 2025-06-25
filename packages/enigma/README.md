# @lindorm/enigma

Secure password hashing using Argon2 with optional multi-layer cryptographic protection.

## Installation

```bash
npm install @lindorm/enigma
```

## Features

- **Argon2id Password Hashing**: Industry-standard password hashing algorithm
- **Multi-Layer Security**: Optional three-layer cryptographic protection
- **Configurable Security Parameters**: Fine-tune memory, time, and parallelism
- **Secret Key Support**: Add pepper for additional security
- **Type-Safe**: Full TypeScript support
- **OWASP Compliant**: Follows password storage best practices

## Quick Start

### Basic Password Hashing with ArgonKit

```typescript
import { ArgonKit } from "@lindorm/enigma";

const argon = new ArgonKit();

// Hash a password
const hash = await argon.hash("user-password");

// Verify a password
const isValid = await argon.verify("user-password", hash);

// Assert password (throws if invalid)
await argon.assert("user-password", hash);
```

### Enhanced Security with Enigma

```typescript
import { Enigma } from "@lindorm/enigma";
import { KryptosAes, KryptosOct } from "@lindorm/kryptos";

// Create encryption keys
const aesKey = KryptosAes.generate({ algorithm: "A256GCM" });
const octKey = KryptosOct.generate({ algorithm: "HS512" });

const enigma = new Enigma({
  aes: { kryptos: aesKey },
  oct: { kryptos: octKey }
});

// Hash with three layers of security
const secureHash = await enigma.hash("sensitive-password");

// Verify through all layers
const isValid = await enigma.verify("sensitive-password", secureHash);
```

## API Reference

### ArgonKit Class

Direct Argon2 password hashing with configurable parameters.

#### Constructor Options

```typescript
interface ArgonKitOptions {
  hashLength?: number;     // Output length in bytes (default: 256)
  memoryCost?: number;     // Memory in KiB (default: 65536 / 64MB)
  parallelism?: number;    // Parallel threads (default: 8)
  timeCost?: number;       // Iterations (default: 12)
  kryptos?: IKryptosOct;   // Optional secret key for pepper
}
```

#### Methods

##### `hash(data: string): Promise<string>`
Hashes the input data using Argon2id.

```typescript
const hash = await argon.hash("password123");
// $argon2id$v=19$m=65536,t=12,p=8$...
```

##### `verify(data: string, hash: string): Promise<boolean>`
Verifies if the data matches the hash.

```typescript
const isValid = await argon.verify("password123", hash);
console.log(isValid); // true or false
```

##### `assert(data: string, hash: string): Promise<void>`
Verifies and throws an error if invalid.

```typescript
try {
  await argon.assert("password123", hash);
  // Password is correct
} catch (error) {
  // Password is incorrect
}
```

### Enigma Class

Multi-layer cryptographic protection combining HMAC signing, Argon2 hashing, and AES encryption.

#### Constructor Options

```typescript
interface EnigmaOptions {
  aes: {
    kryptos: IKryptosAes;    // AES key for encryption layer
  };
  oct: {
    kryptos: IKryptosOct;    // HMAC key for signing layer
  };
  argon?: ArgonKitOptions;   // Optional Argon2 configuration
}
```

#### Security Layers

1. **OCT/HMAC Signing**: Signs the input data
2. **Argon2 Hashing**: Hashes the signed data
3. **AES Encryption**: Encrypts the hash

#### Methods

Same as ArgonKit: `hash()`, `verify()`, and `assert()`.

## Configuration Guide

### Security Parameters

#### Memory Cost
Controls memory usage. Higher values increase security but require more RAM.

```typescript
const argon = new ArgonKit({
  memoryCost: 131072  // 128MB (high security)
});
```

**Recommendations:**
- Minimum: 47104 (46MB)
- Default: 65536 (64MB)
- High Security: 131072 (128MB)

#### Time Cost
Number of iterations. Higher values increase computation time.

```typescript
const argon = new ArgonKit({
  timeCost: 20  // More iterations
});
```

**Recommendations:**
- Minimum: 2
- Default: 12
- High Security: 20+

#### Parallelism
Number of parallel threads. Should match available CPU cores.

```typescript
const argon = new ArgonKit({
  parallelism: 4  // 4 threads
});
```

### Adding Pepper (Secret Key)

```typescript
import { KryptosOct } from "@lindorm/kryptos";

// Generate or load a secret key
const pepper = KryptosOct.generate({ algorithm: "HS256" });

const argon = new ArgonKit({
  kryptos: pepper,
  memoryCost: 65536,
  timeCost: 12
});

// The pepper is automatically mixed into the hash
const hash = await argon.hash("password");
```

## Security Best Practices

### 1. Choose Appropriate Parameters

```typescript
// Standard security (default)
const standard = new ArgonKit();

// High security for sensitive data
const highSecurity = new ArgonKit({
  memoryCost: 131072,  // 128MB
  timeCost: 20,        // More iterations
  hashLength: 512      // Longer hash
});

// Performance-optimized
const performance = new ArgonKit({
  memoryCost: 47104,   // 46MB
  timeCost: 2,         // Minimum iterations
  parallelism: 4       // Fewer threads
});
```

### 2. Use Enigma for Critical Applications

```typescript
// For highly sensitive data (medical records, financial data)
const enigma = new Enigma({
  aes: { kryptos: aesKey },
  oct: { kryptos: hmacKey },
  argon: {
    memoryCost: 131072,
    timeCost: 20
  }
});
```

### 3. Secure Key Management

```typescript
// Store keys securely (environment variables, key management service)
const aesKey = KryptosAes.fromB64({
  privateKey: process.env.AES_PRIVATE_KEY,
  algorithm: "A256GCM"
});

const octKey = KryptosOct.fromB64({
  privateKey: process.env.HMAC_PRIVATE_KEY,
  algorithm: "HS512"
});
```

## Examples

### User Authentication Service

```typescript
import { ArgonKit, ArgonError } from "@lindorm/enigma";

class AuthService {
  private argon: ArgonKit;

  constructor() {
    this.argon = new ArgonKit({
      memoryCost: 65536,
      timeCost: 12,
      parallelism: 8
    });
  }

  async registerUser(username: string, password: string): Promise<void> {
    const hash = await this.argon.hash(password);
    await saveToDatabase({ username, passwordHash: hash });
  }

  async loginUser(username: string, password: string): Promise<boolean> {
    const user = await getUserFromDatabase(username);
    if (!user) return false;

    try {
      await this.argon.assert(password, user.passwordHash);
      return true;
    } catch (error) {
      if (error instanceof ArgonError) {
        // Invalid password
        return false;
      }
      throw error;
    }
  }

  async changePassword(username: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await getUserFromDatabase(username);
    
    // Verify old password
    const isValid = await this.argon.verify(oldPassword, user.passwordHash);
    if (!isValid) {
      throw new Error("Invalid current password");
    }

    // Hash new password
    const newHash = await this.argon.hash(newPassword);
    await updateUserPassword(username, newHash);
  }
}
```

### Secure Document Storage

```typescript
import { Enigma } from "@lindorm/enigma";

class SecureDocumentService {
  private enigma: Enigma;

  constructor(aesKey: IKryptosAes, octKey: IKryptosOct) {
    this.enigma = new Enigma({
      aes: { kryptos: aesKey },
      oct: { kryptos: octKey },
      argon: {
        memoryCost: 131072,  // High security
        timeCost: 20
      }
    });
  }

  async storeDocument(documentId: string, accessCode: string): Promise<void> {
    // Create secure hash of access code
    const hash = await this.enigma.hash(accessCode);
    
    await saveDocument({
      id: documentId,
      accessHash: hash,
      createdAt: new Date()
    });
  }

  async verifyAccess(documentId: string, accessCode: string): Promise<boolean> {
    const document = await getDocument(documentId);
    
    return this.enigma.verify(accessCode, document.accessHash);
  }
}
```

### Password Strength Requirements

```typescript
interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

class PasswordService {
  private argon: ArgonKit;
  private policy: PasswordPolicy;

  constructor(policy: PasswordPolicy) {
    this.argon = new ArgonKit();
    this.policy = policy;
  }

  validatePassword(password: string): string[] {
    const errors: string[] = [];

    if (password.length < this.policy.minLength) {
      errors.push(`Password must be at least ${this.policy.minLength} characters`);
    }

    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push("Password must contain uppercase letters");
    }

    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push("Password must contain lowercase letters");
    }

    if (this.policy.requireNumbers && !/\d/.test(password)) {
      errors.push("Password must contain numbers");
    }

    if (this.policy.requireSpecialChars && !/[!@#$%^&*]/.test(password)) {
      errors.push("Password must contain special characters");
    }

    return errors;
  }

  async hashPassword(password: string): Promise<string> {
    const errors = this.validatePassword(password);
    if (errors.length > 0) {
      throw new Error(errors.join(", "));
    }

    return this.argon.hash(password);
  }
}
```

## Performance Considerations

### Benchmarking Your Configuration

```typescript
async function benchmark() {
  const configs = [
    { name: "Low", memoryCost: 47104, timeCost: 2 },
    { name: "Default", memoryCost: 65536, timeCost: 12 },
    { name: "High", memoryCost: 131072, timeCost: 20 }
  ];

  for (const config of configs) {
    const argon = new ArgonKit(config);
    
    const start = Date.now();
    await argon.hash("benchmark-password");
    const duration = Date.now() - start;
    
    console.log(`${config.name}: ${duration}ms`);
  }
}
```

### Async Operations

All operations are asynchronous to prevent blocking:

```typescript
// Process multiple passwords concurrently
const passwords = ["pass1", "pass2", "pass3"];
const hashes = await Promise.all(
  passwords.map(p => argon.hash(p))
);
```

## Error Handling

### ArgonError

Thrown by ArgonKit for hashing/verification failures:

```typescript
import { ArgonError } from "@lindorm/enigma";

try {
  await argon.assert("wrong-password", hash);
} catch (error) {
  if (error instanceof ArgonError) {
    console.log("Invalid password");
  }
}
```

### EnigmaError

Thrown by Enigma for multi-layer verification failures:

```typescript
import { EnigmaError } from "@lindorm/enigma";

try {
  await enigma.assert("wrong-password", hash);
} catch (error) {
  if (error instanceof EnigmaError) {
    console.log("Verification failed");
  }
}
```

## Migration Guide

### From bcrypt

```typescript
// Before (bcrypt)
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(password, hash);

// After (enigma)
import { ArgonKit } from "@lindorm/enigma";
const argon = new ArgonKit();
const hash = await argon.hash(password);
const isValid = await argon.verify(password, hash);
```

### Upgrading Hash Security

```typescript
async function upgradePasswordHash(username: string, password: string, oldHash: string) {
  // Verify with old system
  const isValid = await oldSystem.verify(password, oldHash);
  if (!isValid) return false;

  // Create new Argon2 hash
  const argon = new ArgonKit();
  const newHash = await argon.hash(password);
  
  // Update database
  await updateUserHash(username, newHash);
  return true;
}
```

## Security Notes

- Argon2id is resistant to both side-channel and GPU attacks
- Default parameters follow OWASP recommendations
- Always use HTTPS when transmitting passwords
- Never log or store plaintext passwords
- Consider rate limiting authentication attempts
- Use Enigma for compliance requirements (HIPAA, PCI-DSS)

## License

AGPL-3.0-or-later
