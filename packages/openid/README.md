# @lindorm/openid

The OpenID Connect / OAuth 2.x **vocabulary** — types, runtime enums, and constants for the wire
surface of an OIDC provider and its clients. One home for the whole vocabulary, so a wire name is
spelled the same everywhere.

It is **not** a client. There is no HTTP in this package, and there never will be — a conduit-based
OIDC client is a separate, later package.

## Why it exists

- **Runtime values, not just types.** A type-only union carries nothing at runtime, so a proteus
  `@Enum` column cannot consume it. Every standard set here ships as a runtime object _and_ a type
  derived from it, so the two cannot drift.
- **Dependency-light and browser-safe.** The only dependency is `@lindorm/types`, and it is imported
  type-only — the built output has zero runtime imports, no Node builtins, no `Buffer`/`process`.
  That is what lets `aegis`, `amphora`, `conduit`, `pylon` and tyr all depend on it without a cycle:
  a client package would cycle with conduit, a vocabulary package cannot.

## Install

```shell
npm install @lindorm/openid
```

## Naming

- **The package is the namespace — no `OpenId` prefix.** `Scope`, `GrantType`, `Claims`,
  `TokenResponse`. The one deliberate exception is `OpenIdConfiguration`, where `OpenId` is the
  document's proper noun rather than a namespace prefix — see [OpenIdConfiguration](#openidconfiguration).
- **`Lindorm*` marks a lindorm extension of an RFC shape.** `Address` composes `LindormAddress`
  (the extra `careOf`) with `StandardAddress`; `Claims` composes `NewLindormClaims` +
  `ExtendingLindormClaims` + `StandardClaims`; `Scope` composes `LindormScope` with `StandardScope`.
  If a name says `Lindorm`, no RFC defines it.
- **Every field carries its wire name.** Types are camelCase; the doc-comment names the snake_case
  wire member, its requirement level, and the spec that defines it. Read the comment before trusting
  a field name.

## Vocabulary sets

Each set is one runtime object plus a type derived from it — the object is the single source.

```typescript
import { GrantType, SubjectType } from "@lindorm/openid";
import type { GrantType as GrantTypeValue } from "@lindorm/openid";

GrantType.AuthorizationCode; // "authorization_code"
SubjectType.Pairwise; // "pairwise"

const requested: GrantTypeValue = "urn:ietf:params:oauth:grant-type:token-exchange";
```

`BackchannelTokenDeliveryMode` · `ClaimType` · `CodeChallengeMethod` · `DisplayMode` · `GrantType` ·
`NamingSystem` · `PromptMode` · `ResponseMode` · `ResponseType` · `Scope` (`LindormScope` +
`StandardScope`) · `SubjectType` · `TokenEndpointAuthMethod`

Sets the specs leave extensible (`GrantType`, `ResponseType`, `ResponseMode`, `PromptMode`, `Scope`,
`TokenEndpointAuthMethod`) derive an **open** type that also accepts an unlisted string. Closed sets
(`CodeChallengeMethod`, `DisplayMode`, `SubjectType`, `ClaimType`, `BackchannelTokenDeliveryMode`,
`NamingSystem`) do not.

`CodeChallengeMethod` is this package's own and is deliberately separate from `@lindorm/pkce`'s
method enum: this one is the OAuth wire vocabulary, that one is the PKCE implementation's.

## Types

Requests and responses: `AuthorizeRequestQuery` · `AuthorizeResponseQuery` · `TokenRequest` ·
`TokenResponse` · `IntrospectResponse` · `LogoutRequest` · `JwksResponse` · `AuthorizationDetail`
(RFC 9396).

Subject data: `Claims` · `Address` · `GeoLocation` · `IdentityProvider` · `InstantMessaging` ·
`SocialNetwork`.

### OpenIdConfiguration

`OpenIdConfiguration` is the provider metadata document — OIDC Discovery 1.0 §3 and RFC 8414 §2,
camelised. **One type serves both directions**: a relying party reading a remote document, and a
provider serving its own. That works because the requirement levels are the specs' own — the seven
members OIDC Discovery marks REQUIRED are required here, everything else is optional and the reader
handles its absence at the point of use.

```typescript
import { ResponseType, SubjectType } from "@lindorm/openid";
import type { OpenIdConfiguration } from "@lindorm/openid";

const configuration: OpenIdConfiguration = {
  issuer: "https://lindorm.io",
  authorizationEndpoint: "https://lindorm.io/oauth/authorize",
  tokenEndpoint: "https://lindorm.io/oauth/token",
  jwksUri: "https://lindorm.io/.well-known/jwks.json",
  responseTypesSupported: [ResponseType.Code],
  subjectTypesSupported: [SubjectType.Pairwise],
  idTokenSigningAlgValuesSupported: ["RS256"],
};
```

The shape is deliberately **closed** — no index signature. Excess-property checking is what catches
a mistyped member when a provider builds its own document. The name keeps its `OpenId` prefix on
purpose: the well-known URI is literally `/.well-known/openid-configuration`, the bare noun
`Configuration` collided with unrelated `config` identifiers at every use site, and the
spec-derived alternatives (`ProviderMetadata`, `AuthorizationServerMetadata`) each name only half
the job — this one type also serves `/.well-known/oauth-authorization-server`. Lindorm extension members
(`gdprRightToErasureEndpoint`, `gdprRightOfAccessEndpoint`, `gdprRightToDataPortabilityEndpoint`) are
grouped separately from the standard set.

## Constants

`WELL_KNOWN_OPENID_CONFIGURATION` · `WELL_KNOWN_OAUTH_AUTHORIZATION_SERVER` ·
`WELL_KNOWN_OAUTH_PROTECTED_RESOURCE` — paths relative to the issuer origin.
Resolve with `new URL(path, issuer)` at the point of use; this package never fetches anything.

## Peer dependencies

None.
