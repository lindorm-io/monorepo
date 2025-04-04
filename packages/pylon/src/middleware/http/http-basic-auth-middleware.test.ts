import { B64 } from "@lindorm/b64";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { AuthorizationType } from "../../enums";
import { Credentials } from "../../types";
import { createHttpBasicAuthMiddleware } from "./http-basic-auth-middleware";

describe("createHttpBasicAuthMiddleware", () => {
  let ctx: any;
  let credentials: Array<Credentials>;

  beforeEach(() => {
    credentials = [
      {
        username: "user",
        password: "pass",
      },
    ];

    ctx = {
      get: jest.fn(),
      logger: createMockLogger(),
      state: {
        authorization: {
          type: AuthorizationType.Basic,
          value: B64.encode("user:pass"),
        },
      },
    };
  });

  test("should resolve", async () => {
    await expect(
      createHttpBasicAuthMiddleware(credentials)(ctx, jest.fn()),
    ).resolves.not.toThrow();
  });

  test("should resolve with custom verify function", async () => {
    const verify = jest.fn();

    await expect(
      createHttpBasicAuthMiddleware(verify)(ctx, jest.fn()),
    ).resolves.not.toThrow();

    expect(verify).toHaveBeenCalledWith("user", "pass");
  });

  test("should reject invalid authorization header", async () => {
    ctx.state.authorization.type = AuthorizationType.None;

    await expect(
      createHttpBasicAuthMiddleware(credentials)(ctx, jest.fn()),
    ).rejects.toThrow(ClientError);
  });

  test("should reject invalid authorization encoding", async () => {
    ctx.state.authorization.value = B64.encode("user");

    await expect(
      createHttpBasicAuthMiddleware(credentials)(ctx, jest.fn()),
    ).rejects.toThrow(ClientError);
  });

  test("should reject invalid authorization username", async () => {
    ctx.state.authorization.value = B64.encode("wrong:pass");

    await expect(
      createHttpBasicAuthMiddleware(credentials)(ctx, jest.fn()),
    ).rejects.toThrow(ClientError);
  });

  test("should reject invalid authorization password", async () => {
    ctx.state.authorization.value = B64.encode("user:wrong");

    await expect(
      createHttpBasicAuthMiddleware(credentials)(ctx, jest.fn()),
    ).rejects.toThrow(ClientError);
  });
});
