import type { StagedMetadata } from "../internal/metadata/index.js";
import { Saga } from "./Saga.js";
import { describe, expect, test } from "vitest";

const createMockContext = (metadata: DecoratorMetadataObject): ClassDecoratorContext =>
  ({ metadata }) as ClassDecoratorContext;

describe("Saga", () => {
  test("should stage saga metadata with single aggregate constructor", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeAggregate {}
    class TestSaga {}

    Saga(FakeAggregate)(TestSaga, createMockContext(metadata));

    const staged = metadata as StagedMetadata;
    expect(staged.saga!.aggregates).toHaveLength(1);
    expect(staged.saga!.aggregates[0]).toBe(FakeAggregate);
    expect(metadata).toMatchSnapshot();
  });

  test("should stage saga metadata with array of aggregate constructors", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeAggregateA {}
    class FakeAggregateB {}
    class TestSaga {}

    Saga([FakeAggregateA, FakeAggregateB])(TestSaga, createMockContext(metadata));

    const staged = metadata as StagedMetadata;
    expect(staged.saga!.aggregates).toHaveLength(2);
    expect(staged.saga!.aggregates[0]).toBe(FakeAggregateA);
    expect(staged.saga!.aggregates[1]).toBe(FakeAggregateB);
  });

  test("should stage saga metadata with custom name via options", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeAggregate {}
    class TestSaga {}

    Saga(FakeAggregate, { name: "custom_saga" })(TestSaga, createMockContext(metadata));

    const staged = metadata as StagedMetadata;
    expect(staged.saga!.name).toBe("custom_saga");
  });

  test("should default name to snake_case of class name", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeAggregate {}
    class OrderProcessingSaga {}

    Saga(FakeAggregate)(OrderProcessingSaga, createMockContext(metadata));

    const staged = metadata as StagedMetadata;
    expect(staged.saga!.name).toBe("order_processing_saga");
  });
});
