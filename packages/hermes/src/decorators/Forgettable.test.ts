import type { StagedMetadata } from "#internal/metadata";
import { Forgettable } from "./Forgettable";

const createMockContext = (metadata: DecoratorMetadataObject): ClassDecoratorContext =>
  ({ metadata }) as ClassDecoratorContext;

describe("Forgettable", () => {
  test("should set forgettable flag on class metadata", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestAggregate {}

    Forgettable()(TestAggregate, createMockContext(metadata));

    expect((metadata as StagedMetadata).forgettable).toMatchSnapshot();
  });
});
