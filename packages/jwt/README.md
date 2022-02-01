# @lindorm-io/jwt

JWT tools for lindorm.io packages.

## Installation

```shell script
npm install --save @lindorm-io/jwt
```

## Usage

### Token Issuer

```typescript
const issuer = new TokenIssuer({
  issuer: "https://authentication.service/",
  keystore: keyPairKeyStore,
  logger: winstonLogger,
});
```

#### Sign

```typescript
const {
  id: tokenId,
  expiresIn,
  expires,
  token,
} = issuer.sign<Payload>({
  id, // OPTIONAL [ string ]
  audiences, // REQUIRED [ Array<string> ]
  authContextClass, // OPTIONAL [ Array<string> ]
  authMethodsReference, // OPTIONAL [ Array<string> ]
  claims, // OPTIONAL [ object ]
  expiry, // REQUIRED [ string | Date | number ]
  nonce, // OPTIONAL [ string ]
  notBefore, // OPTIONAL [ Date ]
  payload, // OPTIONAL [ object ]
  permissions, // OPTIONAL [ Array<string> ]
  scopes, // OPTIONAL [ Array<string> ]
  sessionId, // OPTIONAL [ string ]
  subject, // REQUIRED [ string ]
  subjectHint, // OPTIONAL [ string ]
  type, // REQUIRED [ string ]
  username, // OPTIONAL [ string ]
});
```

#### Verify

```typescript
const {
  id,
  active,
  audiences,
  authContextClass,
  authMethodsReference,
  claims,
  expires,
  expiresIn,
  issuedAt,
  issuer,
  nonce,
  notBefore,
  now,
  payload,
  permissions,
  scopes,
  sessionId,
  subject,
  subjectHint,
  token,
  type,
  username,
} = issuer.verify<Payload>(token, {
  audience, // OPTIONAL [ string ]
  audiences, // OPTIONAL [ Array<string> ]
  clockTolerance, // OPTIONAL [ string ]
  issuer, // OPTIONAL [ string ]
  maxAge, // OPTIONAL [ string ]
  nonce, // OPTIONAL [ string ]
  permissions, // OPTIONAL [ Array<string> ]
  scopes, // OPTIONAL [ Array<string> ]
  subject, // OPTIONAL [ string ]
  subjects, // OPTIONAL [ Array<string> ]
  subjectHint, // OPTIONAL [ string ]
  types, // OPTIONAL [ Array<string> ]
});
```

#### Decode

```typescript
const {
  id,
  active,
  audiences,
  authContextClass,
  authMethodsReference,
  claims,
  expires,
  expiresIn,
  issuedAt,
  issuer,
  keyId,
  nonce,
  notBefore,
  now,
  payload,
  permissions,
  scopes,
  sessionId,
  subject,
  subjectHint,
  type,
  username,
} = TokenIssuer.decode(token);
```

#### Expiry

```typescript
TokenIssuer.getExpiry("10 seconds"); // -> 1577865610
TokenIssuer.getExpiry(20); // -> 1577865610
TokenIssuer.getExpiry(new Date("2020-01-01T08:00:00.000Z")); // -> 1577865600

TokenIssuer.getUnixTime(new Date("2020-01-01T08:00:00.000Z")); // -> 1577865600

TokenIssuer.getExpiryDate(1577865600); // -> new Date("2020-01-01T08:00:00.000Z")
```

#### Sanitiser

```typescript
TokenIssuer.sanitiseToken(token); // -> <base64-header>.<base64-body>
```
