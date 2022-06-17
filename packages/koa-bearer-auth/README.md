# @lindorm-io/koa-bearer-auth

Bearer Auth middleware for @lindorm-io/koa applications

## Installation

```shell script
npm install --save @lindorm-io/koa-bearer-auth
```

### Peer Dependencies

This package has the following peer dependencies:

- [@lindorm-io/jwt](https://www.npmjs.com/package/@lindorm-io/jwt)
- [@lindorm-io/key-pair](https://www.npmjs.com/package/@lindorm-io/key-pair)
- [@lindorm-io/koa](https://www.npmjs.com/package/@lindorm-io/koa)
- [@lindorm-io/koa-jwt](https://www.npmjs.com/package/@lindorm-io/koa-jwt)
- [@lindorm-io/winston](https://www.npmjs.com/package/@lindorm-io/winston)

## Usage

### Bearer Token Middleware

Prerequisite is to add [token issuer](https://www.npmjs.com/package/@lindorm-io/koa-jwt) to the context.

Once the token issuer exists on the context, the middleware is ready to be used

```typescript
const middleware = bearerAuthMiddleware({
  audiences: [configuration.server_oauth_client_id], // OPTIONAL | array | used when all tokens of this type require specific audience
  clockTolerance: 3, // OPTIONAL | number | giving some tolerance for time validation
  contextKey: "tokenKey", // OPTIONAL | string | used to set validated token on context (ctx.token.tokenKey)
  issuer: "https://authorization.service/", // REQURIED | uri | used for token validation
  subjectHint: "identity", // OPTIONAL [ string ]
  types: ["access_token"], // OPTIONAL | string | token type
});

router.use(
  middleware({
    adjustedAccessLevel: 2, // OPTIONAL | number
    audiences: [configuration.server_oauth_client_id], // OPTIONAL | array | used when token on specific route requires specific audiences
    levelOfAssurance: 3, // OPTIONAL | number
    maxAge: 400, // OPTIONAL | number
    permissions: ["admin"], // OPTIONAL | array
    scopes: ["openid"], // OPTIONAL | array

    fromPath: {
      audience: "query.clientId", // OPTIONAL | string | path to string
      nonce: "entity.entityName.nonce", // OPTIONAL | string | path to string
      subject: "data.id", // OPTIONAL | string | path to string
    }, // OPTIONAL | object
  }),
);
```
