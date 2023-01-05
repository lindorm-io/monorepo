import { composeAxiosConfig } from "./compose-axios-config";

describe("composeAxiosConfig", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      req: {
        auth: { username: "username" },
        body: { body: "body" },
        config: { config: "config" },
        headers: { header: "header" },
        host: "https://lindorm.io",
        params: {},
        path: "/test/path",
        port: 3000,
        protocol: "https",
        query: {},
        retry: {},
        retryCallback: () => true,
        timeout: 250,
        withCredentials: true,
      },
    };
  });

  test("should resolve", () => {
    expect(composeAxiosConfig(ctx)).toStrictEqual({
      auth: { username: "username" },
      config: "config",
      data: { body: "body" },
      headers: { header: "header" },
      timeout: 250,
      url: "https://lindorm.io:3000/test/path",
      withCredentials: true,
    });
  });
});
