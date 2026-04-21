import type { StagedMetadata } from "../internal/metadata/index.js";
import { AggregateCommandHandler } from "./AggregateCommandHandler.js";
import { describe, expect, test } from "vitest";

const createMockMethodContext = (
  metadata: DecoratorMetadataObject,
  methodName: string,
): ClassMethodDecoratorContext =>
  ({ metadata, name: methodName }) as ClassMethodDecoratorContext;

describe("AggregateCommandHandler", () => {
  test("should stage handler with correct kind, trigger, and methodName", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeCommand {}

    const fn = () => {};
    AggregateCommandHandler(FakeCommand)(
      fn,
      createMockMethodContext(metadata, "handleCreate"),
    );

    const staged = metadata as StagedMetadata;
    expect(staged.handlers).toHaveLength(1);
    expect(staged.handlers![0].kind).toBe("AggregateCommandHandler");
    expect(staged.handlers![0].methodName).toBe("handleCreate");
    expect(staged.handlers![0].trigger).toBe(FakeCommand);
  });
});
