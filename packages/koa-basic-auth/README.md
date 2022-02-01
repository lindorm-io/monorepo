# @lindorm-io/koa-basic-auth

Basic Auth middleware for @lindorm-io/koa applications

## Installation

```shell script
npm install --save @lindorm-io/koa-basic-auth
```

### Peer Dependencies

This package has the following peer dependencies:

- [@lindorm-io/koa](https://www.npmjs.com/package/@lindorm-io/koa)

## Usage

```typescript
koaApp.addMiddleware(
  basicAuthMiddleware({
    username: "username",
    password: "password",
  }),
);
```
