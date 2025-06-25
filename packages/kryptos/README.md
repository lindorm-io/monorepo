# @lindorm/kryptos

Swiss-army-knife for **JWK / PEM / DER / raw** key management with first-class  
TypeScript support.  `@lindorm/kryptos` lets you _generate_, _import_, _convert_  
and _store_ cryptographic keys (EC, OKP, RSA, oct) without remembering a single  
OpenSSL command.

It includes:

* A powerful `Kryptos` model with rich metadata & lifetime helpers
* `KryptosKit` – fluent factory / utility wrapper
* An interactive **CLI** (`kryptos generate`) for one-off keys

The library is used throughout the Lindorm ecosystem to keep encryption and  
signing keys consistent across services, databases and environment variables.

---

## Installation

```bash
npm install @lindorm/kryptos
# or
yarn add @lindorm/kryptos

# optional – install the CLI globally
npm install -g @lindorm/kryptos
```

Node ≥ 18 is required for the native `crypto` APIs.

---

## Quick start

### 1. Generate a key programmatically

```ts
import { KryptosKit } from '@lindorm/kryptos';

// Create a fresh 521-bit EC signing key (ES512)
const key = KryptosKit.generate.sig.ec({ algorithm: 'ES512', curve: 'P-521' });

console.log(key.id);          // deterministic UUID v4
console.log(key.algorithm);   // "ES512"
console.log(key.type);        // "EC"
console.log(key.curve);       // "P-521"

// Export to different formats
const jwk = key.export('jwk');   // RFC7517 JSON Web Key (private included)
const pem = key.export('pem');   // traditional PEM block
const env = KryptosKit.env.export(key); // compact base64 string – perfect for .env files

// Persist to DB
await db.collection('keys').insertOne(key.toDB());
```

### 2. Import the key later

```ts
import { KryptosKit } from '@lindorm/kryptos';

const envString = process.env.EC_KEY!;
const key = KryptosKit.env.import(envString);

// key is an instance of Kryptos with full metadata
if (key.isActive) {
  jwt.sign(payload, key.privateKey, { algorithm: key.algorithm });
}
```

### 3. Use the CLI

```bash
npx kryptos generate
# Answer a couple of questions (type, use, algorithm…)
# → A base64 blob ready to paste into your .env file
```

---

## Feature highlights

• **Multiple key types** – EC (P-256/384/521), OKP (Ed25519/X448), RSA (modulus  
  sizes 2048-8192) and symmetric `oct` keys.

• **Encryption or Signature** (`use`) with automatic `key_ops` mapping.

• **Automatic algorithm presets** – simply pass the JOSE algorithm you need  
  (e.g. `ES256`, `RSA-OAEP`, `A256KW`, `EdDSA`) and `generate.auto` picks sane  
  defaults for curve / key size.

• **Rich metadata** – `expiresAt`, `issuer`, `purpose`, custom `ownerId`…  
  query helpers like `isExpired`, `expiresIn`, `hasPrivateKey`.

• **Format conversions** – `export('pem' | 'jwk' | 'der' | 'b64')` &  
  corresponding `KryptosKit.from.*` import helpers.

• **Clone & mutate** – `KryptosKit.clone(key, { expiresAt: new Date(...) })`  
  keeps the original untouched while generating a new UUID.

---

## API surface (TL;DR)

```ts
// Generate
KryptosKit.generate.auto({ algorithm: 'EdDSA' });
KryptosKit.generate.sig.rsa({ algorithm: 'RS256', modulusLength: 4096 });
KryptosKit.generate.enc.oct({ algorithm: 'A256KW' });

// Import / export
KryptosKit.from.jwk({ jwkObject });
KryptosKit.from.pem({ pem: '-----BEGIN PRIVATE KEY-----' });
key.export('der');                 // Buffer
key.export('b64');                 // base64 string

// Environment helpers
const envBlob = KryptosKit.env.export(key);
const sameKey = KryptosKit.env.import(envBlob);

// Runtime checks
KryptosKit.isEc(key);  // type predicate narrowing
key.isActive;          // boolean based on nbf/exp

// Persistence
key.toDB();            // plain JSON safe to store in RDBMS / document DB
```

Full type definitions live in `src/types` if you need the nitty-gritty details.

---

## Contributing

1. `cd packages/kryptos && npm ci`  
2. Run the unit tests `npm t` – they should all pass  
3. Follow the existing pattern when adding key types or algorithms  
4. Keep the 100 % snapshot coverage intact ⚡

---

## License

AGPL-3.0-or-later – © Lindorm, 2024
