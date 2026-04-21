import type { StagedMetadata } from "../internal/metadata/index.js";
import { SagaIdHandler } from "./SagaIdHandler.js";
import { describe, expect, test } from "vitest";

const createMockMethodContext = (
  metadata: DecoratorMetadataObject,
  methodName: string,
): ClassMethodDecoratorContext =>
  ({ metadata, name: methodName }) as ClassMethodDecoratorContext;

describe("SagaIdHandler", () => {
  test("should stage handler with correct kind, trigger, and methodName", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeEvent {}

    const fn = () => {};
    SagaIdHandler(FakeEvent)(fn, createMockMethodContext(metadata, "resolveId"));

    const staged = metadata as StagedMetadata;
    expect(staged.handlers).toHaveLength(1);
    expect(staged.handlers![0].kind).toBe("SagaIdHandler");
    expect(staged.handlers![0].methodName).toBe("resolveId");
    expect(staged.handlers![0].trigger).toBe(FakeEvent);
  });
});
