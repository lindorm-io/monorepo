# @lindorm-io/koa-jwt

Token issuer middleware for @lindorm-io/koa applications.

## Installation

```shell script
npm install --save @lindorm-io/koa-jwt
```

## Usage

### Token Issuer Middleware

```typescript
koaApp.addMiddleware(
  tokenIssuerMiddleware({
    issuer: "https://authentication.service", // used for token validation
  }),
);
```

### Token Validation Middleware

```typescript
const middleware = tokenValidationMiddleware({
  audiences: [configuration.server_oauth_client_id], // OPTIONAL | array | used when all tokens of this type require specific audience
  clockTolerance: 300, // OPTIONAL | number | giving some tolerance for time validation
  contextKey: "tokenKey", // REQUIRED | string | used to set validated token on context (ctx.token.tokenKey)
  issuer: "https://authorization.service", // REQURIED | uri | used for token validation
  subjectHint: "identity", // OPTIONAL [ string ]
  types: ["refresh_token"], // REQUIRED | string | token type
});

router.use(
  middleware(
    "request.body.tokenName", // REQUIRED | string | path used to find token
    {
      adjustedAccessLevel: 2, // OPTIONAL | number
      audiences: [configuration.server_oauth_client_id], // OPTIONAL | array | used when token on specific route requires specific audiences
      levelOfAssurance: 3, // OPTIONAL | number
      maxAge: 400, // OPTIONAL | number
      permissions: ["admin"], // OPTIONAL | array
      scopes: ["openid"], // OPTIONAL | array

      fromPath: {
        audience: "query.clientId", // OPTIONAL | string | path to string
        nonce: "entity.entityName.nonce", // OPTIONAL | string | path to string
        subject: "token.bearerToken.subject", // OPTIONAL | string | path to string
      }, // OPTIONAL | object

      optional: false, // OPTIONAL [ boolean ] - determines if middleware should throw when token is missing
    },
  ),
);
```
