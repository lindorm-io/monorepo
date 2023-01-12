import { composeContext } from "./compose-context";

describe("composeContext", () => {
  let axios: any;
  let req: any;

  beforeEach(() => {
    axios = {
      auth: { username: "username" },
      host: "host",
      name: "name",
      port: 4000,
      protocol: "http",
      retry: { retry: "retry" },
      timeout: 500,
      withCredentials: false,
    };
    req = {
      auth: { username: "username" },
      body: { body: "body" },
      config: { config: "config" },
      headers: { header: "header" },
      host: "host",
      method: "method",
      params: { param: "param" },
      path: "/test/path",
      port: 5000,
      protocol: "https",
      query: { query: "query" },
      retry: { retry: "retry" },
      retryCallback: "retryCallback",
      timeout: 250,
      withCredentials: true,
    };
  });

  test("should resolve", () => {
    expect(composeContext(axios, req)).toStrictEqual({
      axios: {
        auth: { username: "username" },
        host: "host",
        name: "name",
        port: 4000,
        protocol: "http",
        retry: { retry: "retry" },
        timeout: 500,
        withCredentials: false,
      },
      req: {
        auth: { username: "username" },
        body: { body: "body" },
        config: { config: "config" },
        headers: { header: "header" },
        host: "host",
        method: "method",
        params: { param: "param" },
        path: "/test/path",
        port: 5000,
        protocol: "https",
        query: { query: "query" },
        retry: { retry: "retry" },
        retryCallback: "retryCallback",
        timeout: 250,
        withCredentials: true,
      },
      res: {
        config: {},
        data: {},
        headers: {},
        request: {},
        status: -1,
        statusText: "",
      },
    });
  });
});
