import type { StagedMetadata } from "../internal/metadata";
import { AggregateErrorHandler } from "./AggregateErrorHandler";
import { describe, expect, test } from "vitest";

const createMockMethodContext = (
  metadata: DecoratorMetadataObject,
  methodName: string,
): ClassMethodDecoratorContext =>
  ({ metadata, name: methodName }) as ClassMethodDecoratorContext;

describe("AggregateErrorHandler", () => {
  test("should stage handler with correct kind, trigger, and methodName", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeError {}

    const fn = () => {};
    AggregateErrorHandler(FakeError)(
      fn,
      createMockMethodContext(metadata, "onDomainError"),
    );

    const staged = metadata as StagedMetadata;
    expect(staged.handlers).toHaveLength(1);
    expect(staged.handlers![0].kind).toBe("AggregateErrorHandler");
    expect(staged.handlers![0].methodName).toBe("onDomainError");
    expect(staged.handlers![0].trigger).toBe(FakeError);
  });
});
