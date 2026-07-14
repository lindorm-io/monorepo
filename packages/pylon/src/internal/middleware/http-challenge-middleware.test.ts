import { describe, expect, test, vi } from "vitest";
import type { PylonHttpContext } from "../../types/index.js";
import { httpChallengeMiddleware } from "./http-challenge-middleware.js";

describe("httpChallengeMiddleware", () => {
  const createCtx = (headers: Record<string, string>): PylonHttpContext =>
    ({
      response: { get: (field: string) => headers[field.toLowerCase()] ?? "" },
      set: (field: string, value: string) => {
        headers[field.toLowerCase()] = value;
      },
    }) as unknown as PylonHttpContext;

  test("should install ctx.challenge", async () => {
    const headers: Record<string, string> = {};
    const ctx = createCtx(headers);
    const next = vi.fn();

    await expect(httpChallengeMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.challenge).toEqual(expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  test("should write the challenge onto the response", async () => {
    const headers: Record<string, string> = {};
    const ctx = createCtx(headers);

    await httpChallengeMiddleware(ctx, vi.fn());

    ctx.challenge("bearer", { realm: "lindorm.io", error: "insufficient_scope" });
    ctx.challenge("basic", { realm: "lindorm.io" });

    expect(headers).toMatchSnapshot();
  });

  test("should reject params the scheme does not define", async () => {
    const ctx = createCtx({});

    await httpChallengeMiddleware(ctx, vi.fn());

    // RFC 7617 defines no error param for Basic — the type must not allow one.
    // @ts-expect-error — `error` is not a Basic challenge param
    ctx.challenge("basic", { error: "invalid_token" });
  });
});
