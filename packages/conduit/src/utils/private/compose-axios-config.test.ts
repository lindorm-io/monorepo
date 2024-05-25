import { RetryStrategy } from "@lindorm/retry";
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
      url: "https://osprey.no:3000/test/path/hello/:answer/:general",
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
      url: "https://osprey.no:3000/test/path/hello/there/kenobi?may=the&force=be&with=you",
      withCredentials: true,
    });
  });
});
