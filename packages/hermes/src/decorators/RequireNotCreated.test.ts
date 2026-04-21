import type { StagedMetadata } from "../internal/metadata";
import { RequireNotCreated } from "./RequireNotCreated";
import { describe, expect, test } from "vitest";

const createMockMethodContext = (
  metadata: DecoratorMetadataObject,
  methodName: string,
): ClassMethodDecoratorContext =>
  ({ metadata, name: methodName }) as ClassMethodDecoratorContext;

describe("RequireNotCreated", () => {
  test("should add requireNotCreated modifier for the decorated method name", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    const fn = () => {};
    RequireNotCreated()(fn, createMockMethodContext(metadata, "handleCreate"));

    const staged = metadata as StagedMetadata;
    expect(staged.methodModifiers).toHaveLength(1);
    expect(staged.methodModifiers![0]).toMatchSnapshot();
  });
});
