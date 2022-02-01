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
  clockTolerance: 3, // OPTIONAL | number | giving some tolerance for time validation
  contextKey: "tokenKey", // OPTIONAL | string | used to set validated token on context (ctx.token.tokenKey)
  issuer: "https://authorization.service/", // REQURIED | uri | used for token validation
  maxAge: "10 minutes", // OPTIONAL | string | used in JWT validation
  subjectHint: "identity", // OPTIONAL [ string ]
  types: ["access_token"], // OPTIONAL | string | token type
});

router.use(
  middleware({
    audience, // OPTIONAL [ string ]
    audiences, // OPTIONAL [ Array<string> ]
    nonce, // OPTIONAL [ string ]
    permissions, // OPTIONAL [ Array<string> ]
    scopes, // OPTIONAL [ Array<string> ]
    subject, // OPTIONAL [ string ]
    subjects, // OPTIONAL [ Array<string> ]

    fromPath: {
      audience, // OPTIONAL [ string ] - path to string on ctx
      audiences, // OPTIONAL [ string ] - path to Array<string> on ctx
      nonce, // OPTIONAL [ string ] - path to string on ctx
      permissions, // OPTIONAL [ string ] - path to Array<string> on ctx
      scopes, // OPTIONAL [ string ] - path to Array<string> on ctx
      subject, // OPTIONAL [ string ] - path to string on ctx
      subjects, // OPTIONAL [ string ] - path to Array<string> on ctx
    },
  }),
);
```
