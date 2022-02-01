# @lindorm-io/koa-jwt

Token issuer middleware for @lindorm-io/koa applications.

## Installation

```shell script
npm install --save @lindorm-io/koa-jwt
```

### Peer Dependencies

This package has the following peer dependencies:

- [@lindorm-io/jwt](https://www.npmjs.com/package/@lindorm-io/jwt)
- [@lindorm-io/key-pair](https://www.npmjs.com/package/@lindorm-io/key-pair)
- [@lindorm-io/koa](https://www.npmjs.com/package/@lindorm-io/koa)
- [@lindorm-io/koa-jwt](https://www.npmjs.com/package/@lindorm-io/koa-jwt)
- [@lindorm-io/winston](https://www.npmjs.com/package/@lindorm-io/winston)

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
  clockTolerance: 3, // OPTIONAL | number | giving some tolerance for time validation
  contextKey: "tokenKey", // REQUIRED | string | used to set validated token on context (ctx.token.tokenKey)
  issuer: "https://authorization.service", // REQURIED | uri | used for token validation
  maxAge: "10 minutes", // OPTIONAL | string | used in JWT validation
  subjectHint: "identity", // OPTIONAL [ string ]
  types: ["refresh_token"], // REQUIRED | string | token type
});

router.use(
  middleware(
    "request.body.tokenName", // REQUIRED | path | used to find token
    {
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

      optional: false, // OPTIONAL [ boolean ] - determines if middleware should throw when token is missing
    },
  ),
);
```
