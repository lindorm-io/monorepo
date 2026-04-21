import type { StagedMetadata } from "../internal/metadata/index.js";
import { SagaErrorHandler } from "./SagaErrorHandler.js";
import { describe, expect, test } from "vitest";

const createMockMethodContext = (
  metadata: DecoratorMetadataObject,
  methodName: string,
): ClassMethodDecoratorContext =>
  ({ metadata, name: methodName }) as ClassMethodDecoratorContext;

describe("SagaErrorHandler", () => {
  test("should stage handler with correct kind, trigger, and methodName", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeError {}

    const fn = () => {};
    SagaErrorHandler(FakeError)(fn, createMockMethodContext(metadata, "onError"));

    const staged = metadata as StagedMetadata;
    expect(staged.handlers).toHaveLength(1);
    expect(staged.handlers![0].kind).toBe("SagaErrorHandler");
    expect(staged.handlers![0].methodName).toBe("onError");
    expect(staged.handlers![0].trigger).toBe(FakeError);
  });
});
