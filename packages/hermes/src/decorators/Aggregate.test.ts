import { Aggregate } from "./Aggregate";
import { describe, expect, test } from "vitest";

const createMockContext = (metadata: DecoratorMetadataObject): ClassDecoratorContext =>
  ({ metadata }) as ClassDecoratorContext;

describe("Aggregate", () => {
  test("should stage aggregate metadata with snake_case name from class name", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestAggregate {}

    Aggregate()(TestAggregate, createMockContext(metadata));

    expect(metadata).toMatchSnapshot();
  });

  test("should stage aggregate metadata with custom name", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestAggregate {}

    Aggregate("my_custom_aggregate")(TestAggregate, createMockContext(metadata));

    expect(metadata).toMatchSnapshot();
  });
});
