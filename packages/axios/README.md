# @lindorm-io/axios

Axios Request Handler for lindorm.io packages.

## Installation

```shell script
npm install --save @lindorm-io/axios
```

## Usage

### Axios

Creates a wrapper around the axios package that makes it much easier to perform standard requests. Improves the request with new middleware configuration.

```typescript
const axios = new Axios({
  alias: "ClientAlias",
  auth: {
    username: "basic-username",
    password: "basic-password",
  },
  baseUrl: "https://lindorm.io",
  middleware: [
    axiosTransformResponseDataMiddleware(TransformMode.CAMEL)
  ],
  headers: {
    "x-request-header": "string-value"
  },
}, logger);

const res = await axios.get("/path/:param_1", {
  params: { param_1: "value" },
});

const res = await axios.post("/path", {
  body: { key: "value" },
});

const res = await axios.put("/path", {
  body: { key: "value" },
});

const res = await axios.patch("/path", {
  body: { key: "value" },
});

const res = await axios.delete("/path", {
  headers: { "x-extra-header": "value" },
  query: { someThing: "hello" },
});
```

### Middleware

With middleware you are able to add handlers that enhance or validate your request context before the Promise is resolved.

Middleware can be added to the constructor config, and it can be added as part of any request options.

```typescript
const yourMiddleware: Middleware = async (context, next): Promise<void> => {
  console.log("before", context.req)

  await next()

  console.log("after", context.res)
};

const axios = new Axios({ middleware: [yourMiddleware] });

const response = await axios.put("/path", {
  middleware: [yourMiddleware],
});
```
