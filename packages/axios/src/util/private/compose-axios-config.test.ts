import { RequestContext } from "../../types";
import { composeAxiosConfig } from "./compose-axios-config";

describe("composeAxiosConfig", () => {
  let ctx: any;

  beforeEach(() => {
    const req: RequestContext = {
      body: { body: "body" },
      config: {
        auth: { username: "username", password: "password" },
        timeout: 250,
        withCredentials: true,
      },
      correlationId: "correlationId",
      headers: { header: "header" },
      params: {
        answer: "there",
        general: "kenobi",
      },
      query: {
        may: "the",
        force: "be",
        with: "you",
      },
      requestId: "id",
      retry: { maximumAttempts: 5, maximumMilliseconds: 10, milliseconds: 50, strategy: "linear" },
      retryCallback: () => true,
      url: "https://lindorm.io:3000/test/path/hello/:answer/:general",
    };

    ctx = { req };
  });

  test("should resolve", () => {
    expect(composeAxiosConfig(ctx)).toStrictEqual({
      auth: {
        password: "password",
        username: "username",
      },
      data: {
        body: "body",
      },
      headers: {
        header: "header",
      },
      timeout: 250,
      url: "https://lindorm.io:3000/test/path/hello/there/kenobi?may=the&force=be&with=you",
      withCredentials: true,
    });
  });
});
