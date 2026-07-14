import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import type { AuthorizationType, PylonHttpContext } from "../../../types/index.js";
import { deriveChallenge } from "./derive-challenge.js";

describe("deriveChallenge", () => {
  let headers: Record<string, string>;
  let logger: ReturnType<typeof createMockLogger>;

  const createCtx = (type: AuthorizationType | undefined): PylonHttpContext =>
    ({
      logger,
      response: { get: (field: string) => headers[field.toLowerCase()] ?? "" },
      set: (field: string, value: string) => {
        headers[field.toLowerCase()] = value;
      },
      state: type
        ? {
            app: { domain: "https://lindorm.io" },
            authorization: { type, value: type === "none" ? null : "value" },
          }
        : undefined,
    }) as unknown as PylonHttpContext;

  beforeEach(() => {
    headers = {};
    logger = createMockLogger();
  });

  test("should derive a basic challenge without an error param", () => {
    deriveChallenge(createCtx("basic"));

    expect(headers).toMatchSnapshot();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("should derive a bearer challenge", () => {
    deriveChallenge(createCtx("bearer"));

    expect(headers).toMatchSnapshot();
  });

  test("should derive a dpop challenge", () => {
    deriveChallenge(createCtx("dpop"));

    expect(headers).toMatchSnapshot();
  });

  test("should emit nothing and warn when the client attempted no scheme", () => {
    deriveChallenge(createCtx("none"));

    expect(headers).toEqual({});
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("ctx.challenge()"));
  });

  test("should emit nothing and warn when state is missing", () => {
    deriveChallenge(createCtx(undefined));

    expect(headers).toEqual({});
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("ctx.challenge()"));
  });

  test("should not throw when the logger is absent", () => {
    // An error thrown before the context initialisation middleware ran leaves ctx.logger unset.
    const ctx = createCtx(undefined);
    delete (ctx as any).logger;

    expect(() => deriveChallenge(ctx)).not.toThrow();
    expect(headers).toEqual({});
  });
});
