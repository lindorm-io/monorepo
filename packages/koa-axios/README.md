# @lindorm-io/koa-axios

Axios Request Handler middleware for @lindorm-io/koa applications.

## Installation

```shell script
npm install --save @lindorm-io/koa-axios
```

### Peer Dependencies

This package has the following peer dependencies:

- [@lindorm-io/axios](https://www.npmjs.com/package/@lindorm-io/axios)
- [@lindorm-io/koa](https://www.npmjs.com/package/@lindorm-io/koa)
- [@lindorm-io/winston](https://www.npmjs.com/package/@lindorm-io/winston)

## Usage

```typescript
koaApp.addMiddleware(
  axiosMiddleware({
    baseUrl: "https://lindorm.io/", // optional [string]
    basicAuth: {
      // optional [object]
      username: "username",
      password: "password",
    },
    clientName: "axiosClient", // required [string]
    middleware: [], // optional [Array<AxiosMiddleware>]
  }),
);

const response = await ctx.axios.axiosClient.get("/path");
```
