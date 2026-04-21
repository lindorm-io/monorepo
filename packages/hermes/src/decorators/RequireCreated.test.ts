import type { StagedMetadata } from "../internal/metadata";
import { RequireCreated } from "./RequireCreated";
import { describe, expect, test } from "vitest";

const createMockMethodContext = (
  metadata: DecoratorMetadataObject,
  methodName: string,
): ClassMethodDecoratorContext =>
  ({ metadata, name: methodName }) as ClassMethodDecoratorContext;

describe("RequireCreated", () => {
  test("should add requireCreated modifier for the decorated method name", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    const fn = () => {};
    RequireCreated()(fn, createMockMethodContext(metadata, "handleMerge"));

    const staged = metadata as StagedMetadata;
    expect(staged.methodModifiers).toHaveLength(1);
    expect(staged.methodModifiers![0]).toMatchSnapshot();
  });
});
