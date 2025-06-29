import { RetryStrategy } from "@lindorm/retry";
import { REPLACE_URL } from "../../constants/private";
import { RequestContext } from "../../types";
import { composeAxiosConfig } from "./compose-axios-config";

describe("composeAxiosConfig", () => {
  let ctx: any;

  beforeEach(() => {
    const req: RequestContext = {
      body: { body: "body" },
      config: {
        timeout: 250,
        withCredentials: true,
      },
      filename: undefined,
      form: undefined,
      headers: { header: "header" },
      metadata: {
        correlationId: "correlationId",
        requestId: "id",
        sessionId: "sessionId",
      },
      params: {
        answer: "there",
        general: "kenobi",
      },
      query: {
        may: "the",
        force: "be",
        with: "you",
      },
      retryCallback: () => true,
      retryConfig: {
        maxAttempts: 3,
        strategy: RetryStrategy.Linear,
        timeout: 25,
        timeoutMax: 3000,
      },
      stream: undefined,
      url: "https://lindorm.io:3000/test/path/hello/:answer/:general",
    };

    ctx = { req };
  });

  test("should resolve", async () => {
    await expect(composeAxiosConfig(ctx)).resolves.toEqual({
      data: {
        body: "body",
      },
      headers: { "Content-Type": "application/json", header: "header" },
      timeout: 250,
      url: "https://lindorm.io:3000/test/path/hello/there/kenobi?may=the&force=be&with=you",
      withCredentials: true,
    });
  });

  test("should resolve without host", async () => {
    ctx.req.url = REPLACE_URL + "/test/path/hello/:answer/:general";

    await expect(composeAxiosConfig(ctx)).resolves.toEqual({
      data: {
        body: "body",
      },
      headers: { "Content-Type": "application/json", header: "header" },
      timeout: 250,
      url: "/test/path/hello/there/kenobi?may=the&force=be&with=you",
      withCredentials: true,
    });
  });
});
