# @lindorm-io/crypto

Simplified crypto handlers for lindorm.io packages

## Installation

```shell script
npm install --save @lindorm-io/crypto
```

## Usage

### CryptoAES

Wraps the crypto-js AES functions in a simple helper class

```typescript
const aes = new CryptoAES({
  secret: "secret",
});
const signature = aes.encrypt("input");

const valid = aes.verify("input", signature);
const decrypted = aes.decrypt(signature);
aes.assert("input", signature);
```

### CryptoSHA

Wraps the crypto-js SHA functisns in a simple helper class

```typescript
const sha = new CryptoSHA({
  secret: "secret",
});
const signature = sha.encrypt("input");

const valid = sha.verify("input", signature);
sha.assert("input", signature);
```

### CryptoArgon

Wraps the argon2 functions in a simple helper class

```typescript
const argon = new CryptoArgon();
const signature = await argon.encrypt("input");

const valid = await argon.verify("input", signature);
await argon.assert("input", signature);
```

### CryptoPassword

Wraps passwords in an onion using CryptoAES, CryptoSHA, and CryptoArgon.

```typescript
const password = new CryptoPassword({
  aesSecret: "aes-secret",
  shaSecret: "sha-secret",
});
const signature = await password.encrypt("input");

const valid = await password.verify("input", signature);
await password.assert("input", signature);
```

### CryptoSecret

Wraps secrets in an onion using CryptoAES and CryptoSHA.

```typescript
const secret = new CryptoSecret({
  aesSecret: "aes-secret",
  shaSecret: "sha-secret",
});
const signature = await secret.encrypt("input");

const valid = await secret.verify("input", signature);
await secret.assert("input", signature);
```
