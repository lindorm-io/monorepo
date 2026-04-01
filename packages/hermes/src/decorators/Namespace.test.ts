import type { StagedMetadata } from "#internal/metadata";
import { Namespace } from "./Namespace";

const createMockContext = (metadata: DecoratorMetadataObject): ClassDecoratorContext =>
  ({ metadata }) as ClassDecoratorContext;

describe("Namespace", () => {
  test("should set namespace string on class metadata", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestAggregate {}

    Namespace("billing")(TestAggregate, createMockContext(metadata));

    expect((metadata as StagedMetadata).namespace).toBe("billing");
    expect(metadata).toMatchSnapshot();
  });
});
