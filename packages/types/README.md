# @lindorm/types

Shared TypeScript types and a small set of `const` runtime values used across the Lindorm monorepo.

This package is **ESM-only**. All examples use `import` syntax — `require` is not supported.

## Installation

```bash
npm install @lindorm/types
```

This package has no runtime or peer dependencies.

## Features

- JOSE-aligned JWK types: `Jwks`, `LindormJwks`, `JwksAlgorithm`, `JwksEncryptionAlgorithm`, `JwksSigningAlgorithm`, `JwksCurve`, `JwksKeyOps`, `JwksKeyType`, `JwksUse`
- A catalogue of OpenID Connect request, response, claim, and enum types covering authorize, token, introspect, revoke, logout, backchannel authentication, and provider configuration flows
- AES content-encryption algorithm tags and key-length constants (`AesEncryption`, `AesCbcEncryption`, `AesGcmEncryption`, `AES_ENCRYPTION_ALGORITHMS`, `AES_KEY_LENGTH_*`)
- Generic crypto primitives: `KeyData`, `DsaEncoding`, `ShaAlgorithm`
- Predicate generics (`Predicate<T>`, `RootPredicate<T>`, `PredicateOperator<T>`) used by repository drivers across the monorepo
- `AbortSignal` companions: an `AbortReason` discriminated union and a `WithSignal<T>` mixin
- A `DpopSigner` contract for RFC 9449 DPoP proofs that does not take a hard dependency on `node:crypto`
- General TypeScript helpers (`DeepPartial<T>`, `Dict<T>`, `Optional<T, K>`, `Constructor<T>`, `ClassLike<T>`, `ReverseMap<T>`, `Function<T>`, `Header`, `Param`, `Query`)
- String-literal enums: `Environment`, `HttpMethod`, `PkceMethod`, `Priority`
- The `IKeyKit` interface used by signing and verification utilities

## Usage

```typescript
import type {
  AbortReason,
  Dict,
  HttpMethod,
  IKeyKit,
  KeyData,
  OpenIdTokenResponse,
  Predicate,
  WithSignal,
} from "@lindorm/types";

const sign: IKeyKit["sign"] = (data: KeyData) => Buffer.from(data);

type FetchOptions = WithSignal<{ method: HttpMethod; body?: Dict }>;

const fetchToken = async (opts: FetchOptions): Promise<OpenIdTokenResponse> => {
  // ...
};

const adultUserQuery: Predicate<{ id: string; age: number }> = {
  age: { $gte: 18 },
};

const onAbort = (reason: AbortReason) => {
  if (reason.kind === "request-timeout") {
    console.warn(`timed out after ${reason.timeoutMs}ms`);
  }
};
```

The package also exports a few runtime values:

```typescript
import {
  AES_ENCRYPTION_ALGORITHMS,
  AES_KEY_LENGTH_A256GCM,
  CBC_ENCRYPTION_ALGORITHMS,
  GCM_ENCRYPTION_ALGORITHMS,
} from "@lindorm/types";

const isAesAlgorithm = (value: string): boolean =>
  (AES_ENCRYPTION_ALGORITHMS as readonly string[]).includes(value);

console.log(AES_KEY_LENGTH_A256GCM); // 32
```

## API reference

### Interfaces

- `IKeyKit` — `sign(data)`, `verify(data, signature)`, `assert(data, signature)`, `format(data)`. Contract for a signing/verification kit operating on `KeyData` (`Buffer | string`); `sign` returns a `Buffer`, `verify` returns a `boolean`, `assert` throws on mismatch, and `format` produces a string representation of a `Buffer`.

### JWK types

- `Jwks` — JSON Web Key shape (`alg`, `kty`, `kid`, `use`, `keyOps`, plus optional curve, modulus, and exponent fields) extended with optional Lindorm fields from `LindormJwks` (`enc`, `iat`, `iss`, `jku`, `nbf`, `uat`, `exp`, `owner_id`)
- `LindormJwks` — Lindorm-only JWK metadata fields
- `JwksAlgorithm` — union of `JwksEncryptionAlgorithm` and `JwksSigningAlgorithm`
- `JwksEncryptionAlgorithm` — JWE alg values: `dir`, `A128KW`–`A256KW`, `A128GCMKW`–`A256GCMKW`, `ECDH-ES` family, `PBES2` family, `RSA-OAEP` family
- `JwksSigningAlgorithm` — JWS alg values: `EdDSA`, `ES256`–`ES512`, `HS256`–`HS512`, `PS256`–`PS512`, `RS256`–`RS512`
- `JwksCurve` — `Ed25519`, `Ed448`, `P-256`, `P-384`, `P-521`, `X25519`, `X448`
- `JwksKeyOps` — `decrypt`, `deriveBits`, `deriveKey`, `encrypt`, `sign`, `unwrapKey`, `verify`, `wrapKey`
- `JwksKeyType` — `EC`, `oct`, `OKP`, `RSA`
- `JwksUse` — `enc`, `sig`

### OpenID Connect types

- Request shapes: `OpenIdAuthorizeRequestQuery`, `OpenIdBackchannelAuthenticationRequest`, `OpenIdIntrospectRequest`, `OpenIdLogoutRequest`, `OpenIdRevokeRequest`, `OpenIdTokenRequest`
- Response shapes: `OpenIdAuthorizeResponseQuery`, `OpenIdIntrospectResponse`, `OpenIdJwksResponse`, `OpenIdTokenResponse`, `OpenIdConfiguration`, `OpenIdConfigurationResponse`, `OpenIdErrorResponse`
- Claims and value objects: `OpenIdClaims`, `OpenIdTokenClaims`, `OpenIdAddress`, `OpenIdGeoLocation`, `OpenIdIdentityProvider`, `OpenIdInstantMessaging`, `OpenIdSocialNetwork`, `OpenIdTokenExchangeAct`
- Enumerations: `OpenIdBackchannelTokenDeliveryMode`, `OpenIdClientProfile`, `OpenIdClientType`, `OpenIdCodeChallengeMethod`, `OpenIdDisplayMode`, `OpenIdErrorCode`, `OpenIdGrantType`, `OpenIdPromptMode`, `OpenIdResponseMode`, `OpenIdResponseType`, `OpenIdScope`, `OpenIdSubjectType`, `OpenIdTokenAuthMethod`, `OpenIdTokenHeaderType`, `OpenIdTokenType`

### AES types and constants

- `AesEncryption` — union of every supported AES content-encryption algorithm tag
- `AesCbcEncryption` — CBC-only subset (`A128CBC-HS256`, `A192CBC-HS384`, `A256CBC-HS512`)
- `AesGcmEncryption` — GCM-only subset (`A128GCM`, `A192GCM`, `A256GCM`)
- `AES_ENCRYPTION_ALGORITHMS` — readonly tuple of every AES tag
- `CBC_ENCRYPTION_ALGORITHMS`, `GCM_ENCRYPTION_ALGORITHMS` — readonly tuples of the CBC and GCM subsets
- `AesKeyLength` — union of byte lengths required by each AES algorithm
- `AES_KEY_LENGTH_A128GCM` (16), `AES_KEY_LENGTH_A192GCM` (24), `AES_KEY_LENGTH_A256GCM` (32), `AES_KEY_LENGTH_A128CBC_HS256` (32), `AES_KEY_LENGTH_A192CBC_HS384` (48), `AES_KEY_LENGTH_A256CBC_HS512` (64) — numeric `as const` values, plus matching `AesKeyLength_*` types
- `AES_KEY_LENGTHS` — readonly tuple of every supported key length

### Crypto primitives

- `KeyData` — `Buffer | string`
- `DsaEncoding` — `der`, `ieee-p1363`
- `ShaAlgorithm` — `SHA1`, `SHA256`, `SHA384`, `SHA512`

### Predicate generics

- `Predicate<T>` — top-level query shape with `$and`, `$or`, `$not` plus a `RootPredicate<T>`
- `RootPredicate<T>` — per-field predicate map without root logical combinators
- `PredicateOperator<T>` — operator object for a single field, supporting existence (`$exists`, `$eq`, `$neq`), comparisons (`$gt`, `$gte`, `$lt`, `$lte`, `$between`), fuzzy matches (`$like`, `$ilike`, `$regex`), array operators (`$in`, `$nin`, `$all`, `$overlap`, `$contained`, `$length`), JSON containment (`$has`), modulo (`$mod`), and nested logical combinators (`$and`, `$or`, `$not`)

### Abort companions

- `AbortReason` — discriminated union of structured reasons that Lindorm packages may attach to `AbortSignal.reason`: `client-disconnect`, `request-timeout`, `server-shutdown`, `parent-aborted`, `rate-limit-exceeded`, `breaker-open`, `manual`. Consumers must tolerate arbitrary reasons, including values produced outside the Lindorm ecosystem.
- `WithSignal<T>` — mixin that adds an optional `signal?: AbortSignal` to an option object

### DPoP

- `DpopSigner` — `{ algorithm: JwksAlgorithm; publicJwk: Jwks; sign(data: Uint8Array): Promise<Uint8Array> }`. Abstract signer used to mint RFC 9449 DPoP proof JWTs without coupling to a specific crypto backend.

### General helpers

- `ClassLike<T>`, `Constructor<T>`, `Function<T>`
- `DeepPartial<T>`, `Dict<T>`, `Optional<T, K>`, `ReverseMap<T>`
- `Header`, `Param`, `Query`

### String-literal enums

- `Environment` — `production`, `staging`, `development`, `test`, `unknown`
- `HttpMethod` — `Get`, `Post`, `Put`, `Delete`, `Patch`, `Options`, `Head`, plus their fully lowercased and fully uppercased variants
- `PkceMethod` — `S256`, `plain`
- `Priority` — `critical`, `high`, `medium`, `low`, `background`, `default`

## License

AGPL-3.0-or-later
