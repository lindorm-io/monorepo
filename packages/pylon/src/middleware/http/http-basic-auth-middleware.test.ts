import { B64 } from "@lindorm/b64";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { Credentials } from "../../types";
import { createHttpBasicAuthMiddleware } from "./http-basic-auth-middleware";

describe("createHttpBasicAuthMiddleware", () => {
  const next = jest.fn();

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
    };
  });

  test("should resolve", async () => {
    ctx.get.mockReturnValue(`Basic ${B64.encode("user:pass")}`);

    await expect(
      createHttpBasicAuthMiddleware(credentials)(ctx, next),
    ).resolves.not.toThrow();
  });

  test("should reject missing authorization header", async () => {
    ctx.get.mockReturnValue(null);

    await expect(createHttpBasicAuthMiddleware(credentials)(ctx, next)).rejects.toThrow(
      ClientError,
    );
  });

  test("should reject invalid authorization header", async () => {
    ctx.get.mockReturnValue(`Wrong ${B64.encode("user:pass")}`);

    await expect(createHttpBasicAuthMiddleware(credentials)(ctx, next)).rejects.toThrow(
      ClientError,
    );
  });

  test("should reject invalid authorization encoding", async () => {
    ctx.get.mockReturnValue(`Basic ${B64.encode("user")}`);

    await expect(createHttpBasicAuthMiddleware(credentials)(ctx, next)).rejects.toThrow(
      ClientError,
    );
  });

  test("should reject invalid authorization username", async () => {
    ctx.get.mockReturnValue(`Basic ${B64.encode("wrong:pass")}`);

    await expect(createHttpBasicAuthMiddleware(credentials)(ctx, next)).rejects.toThrow(
      ClientError,
    );
  });

  test("should reject invalid authorization username", async () => {
    ctx.get.mockReturnValue(`Basic ${B64.encode("user:wrong")}`);

    await expect(createHttpBasicAuthMiddleware(credentials)(ctx, next)).rejects.toThrow(
      ClientError,
    );
  });
});
