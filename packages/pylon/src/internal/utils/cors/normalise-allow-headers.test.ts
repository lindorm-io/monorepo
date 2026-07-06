import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { normaliseAllowHeaders } from "./normalise-allow-headers.js";
import { beforeEach, describe, expect, test } from "vitest";

describe("normaliseAllowHeaders", () => {
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    logger = createMockLogger();
  });

  test("should auto-inject content-type when it is not listed", () => {
    expect(normaliseAllowHeaders(["authorization"], logger)).toEqual([
      "authorization",
      "content-type",
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("should strip a listed content-type and re-add it exactly once, with a warning", () => {
    expect(normaliseAllowHeaders(["content-type", "authorization"], logger)).toEqual([
      "authorization",
      "content-type",
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('"content-type" is auto-injected'),
    );
  });

  test("should strip CORS-safelisted headers with a warning and NOT re-add them", () => {
    expect(
      normaliseAllowHeaders(
        ["accept", "accept-language", "content-language", "x-user-agent-name"],
        logger,
      ),
    ).toEqual(["x-user-agent-name", "content-type"]);
    expect(logger.warn).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('"accept" is already CORS-safelisted'),
    );
  });

  test("should de-duplicate headers", () => {
    expect(
      normaliseAllowHeaders(["x-foo", "x-foo", "authorization", "x-foo"], logger),
    ).toEqual(["x-foo", "authorization", "content-type"]);
  });

  test("should leave the conditionally-safelisted range header untouched", () => {
    expect(normaliseAllowHeaders(["range"], logger)).toEqual(["range", "content-type"]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("should not throw when no logger is provided", () => {
    expect(normaliseAllowHeaders(["accept", "content-type", "x-foo"])).toEqual([
      "x-foo",
      "content-type",
    ]);
  });
});
