import { TransformMode } from "@lindorm-io/case";
import { RequestContext } from "../../types";
import { composeAxiosConfig } from "./compose-axios-config";

describe("composeAxiosConfig", () => {
  let ctx: any;

  beforeEach(() => {
    const req: RequestContext = {
      body: { body: "body" },
      client: {
        id: "8badb9a8-e4dd-4970-bdf5-f2765b912e7e",
        environment: "test",
        name: "TestClient",
        platform: "platform",
        version: "version",
      },
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
      queryCaseTransform: TransformMode.PASCAL,
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
      url: "https://lindorm.io:3000/test/path/hello/there/kenobi?May=the&Force=be&With=you",
      withCredentials: true,
    });
  });
});
