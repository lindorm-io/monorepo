# @lindorm-io/axios

Axios Request Handler for lindorm.io packages.

## Installation

```shell script
npm install --save @lindorm-io/axios
```

### Peer Dependencies

This package has the following peer dependencies:

- [@lindorm-io/winston](https://www.npmjs.com/package/@lindorm-io/winston)

## Usage

### Axios

Creates a wrapper around the axios package that makes it somewhat easier to perform some standard requests.

```typescript
const axios = new Axios({
  baseUrl: "https://lindorm.io",
  auth: {
    basic: { username: "secret", password: "secret" },
    bearer: "jwt.jwt.jwt",
  },
  logger: winston,
  middleware: [],
  name: "Client Name",
});

const response = await axios.get("/path", {
  params: { param_1: "value" },
});

const response = await axios.post("/path", {
  data: { key: "value" },
});

const response = await axios.put("/path", {
  data: { key: "value" },
});

const response = await axios.patch("/path", {
  data: { key: "value" },
});

const response = await axios.delete("/path", {
  headers: { "X-Extra-Header": "value" },
});
```

### Middleware

With middleware you are able to add handlers that enhance or validate your request/response/error before the Promise is resolved.

Middleware can be added to the constructor config, and it can be added as part of any request options.

```typescript
const yourMiddleware = {
  request: async (request: IAxiosRequest): Promise<IAxiosRequest> => {
    // enhance request
    return request;
  },
  response: async (response: IAxiosResponse): Promise<IAxiosResponse> => {
    // enhance response
    return response;
  },
  error: async (error: IAxiosError): Promise<IAxiosError> => {
    // enhance error
    return error;
  },
};

const axios = new Axios({ middleware: [yourMiddleware] });

const response = await axios.put("/path", {
  middleware: [yourMiddleware],
});
```

### Auth

Auth can be added as part of the constructor config, but it will not be used unless explicitly told to, since not all paths require auth - or the same auth. When you wish to use your configured auth, you can enable it from the request options object.

```typescript
const response = await axios.post("/path", {
  auth: AuthType.BEARER,
  data: { key: "value" },
});
```

### Case Switching

Axios automatically converts all object keys on the request data to snake_case right before the request is made. Axios will also automatically convert all object keys on response data to camelCase.

### Logging

Axios will automatically log prudent response data with the help of lindorm-io/winston.
