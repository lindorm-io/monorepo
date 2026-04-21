import { buildPylonEnvelope } from "./build-pylon-envelope.js";
import { describe, expect, test } from "vitest";

describe("buildPylonEnvelope", () => {
  test("should build envelope with payload", () => {
    const result = buildPylonEnvelope({
      correlationId: "corr-123",
      payload: { foo: "bar" },
    });

    expect(result).toMatchSnapshot();
  });

  test("should build envelope with undefined payload", () => {
    const result = buildPylonEnvelope({
      correlationId: "corr-456",
      payload: undefined,
    });

    expect(result).toMatchSnapshot();
  });

  test("should build envelope with null payload", () => {
    const result = buildPylonEnvelope({
      correlationId: "corr-789",
      payload: null,
    });

    expect(result).toMatchSnapshot();
  });

  test("should always set __pylon to true", () => {
    const result = buildPylonEnvelope({
      correlationId: "any",
      payload: "data",
    });

    expect(result.__pylon).toBe(true);
  });
});
