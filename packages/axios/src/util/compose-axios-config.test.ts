import { composeAxiosConfig } from "./compose-axios-config";
import { RequestContext } from "../types";

describe("composeAxiosConfig", () => {
  let ctx: any;

  beforeEach(() => {
    const req = {
      auth: { username: "username", password: "password" },
      body: { body: "body" },
      config: {},
      headers: { header: "header" },
      host: "https://lindorm.io",
      method: "post",
      params: {},
      path: "/test/path",
      port: 3000,
      protocol: "https",
      query: {},
      queryCaseTransform: "pascal",
      retry: { maximumAttempts: 5, maximumMilliseconds: 10, milliseconds: 50, strategy: "linear" },
      retryCallback: () => true,
      timeout: 250,
      withCredentials: true,
    } satisfies RequestContext;

    ctx = { req };
  });

  test("should resolve", () => {
    expect(composeAxiosConfig(ctx)).toStrictEqual({
      auth: { username: "username", password: "password" },
      method: "post",
      data: { body: "body" },
      headers: { header: "header" },
      timeout: 250,
      url: "https://lindorm.io:3000/test/path",
      withCredentials: true,
    });
  });
});
