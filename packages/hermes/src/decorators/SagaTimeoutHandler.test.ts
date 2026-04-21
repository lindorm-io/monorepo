import type { StagedMetadata } from "../internal/metadata/index.js";
import { SagaTimeoutHandler } from "./SagaTimeoutHandler.js";
import { describe, expect, test } from "vitest";

const createMockMethodContext = (
  metadata: DecoratorMetadataObject,
  methodName: string,
): ClassMethodDecoratorContext =>
  ({ metadata, name: methodName }) as ClassMethodDecoratorContext;

describe("SagaTimeoutHandler", () => {
  test("should stage handler with correct kind, trigger, and methodName", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeTimeout {}

    const fn = () => {};
    SagaTimeoutHandler(FakeTimeout)(fn, createMockMethodContext(metadata, "onTimeout"));

    const staged = metadata as StagedMetadata;
    expect(staged.handlers).toHaveLength(1);
    expect(staged.handlers![0].kind).toBe("SagaTimeoutHandler");
    expect(staged.handlers![0].methodName).toBe("onTimeout");
    expect(staged.handlers![0].trigger).toBe(FakeTimeout);
  });
});
