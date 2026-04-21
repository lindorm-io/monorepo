import type { StagedMetadata } from "../internal/metadata";
import { View } from "./View";
import { describe, expect, test } from "vitest";

const createMockContext = (metadata: DecoratorMetadataObject): ClassDecoratorContext =>
  ({ metadata }) as ClassDecoratorContext;

describe("View", () => {
  test("should stage view metadata with single aggregate, entity, and null driverType", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeAggregate {}
    class FakeEntity {}
    class TestView {}

    View(FakeAggregate, FakeEntity)(TestView, createMockContext(metadata));

    const staged = metadata as StagedMetadata;
    expect(staged.view!.aggregates).toHaveLength(1);
    expect(staged.view!.aggregates[0]).toBe(FakeAggregate);
    expect(staged.view!.entity).toBe(FakeEntity);
    expect(staged.view!.driverType).toBeNull();
    expect(metadata).toMatchSnapshot();
  });

  test("should stage view metadata with array of aggregates", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeAggregateA {}
    class FakeAggregateB {}
    class FakeEntity {}
    class TestView {}

    View([FakeAggregateA, FakeAggregateB], FakeEntity)(
      TestView,
      createMockContext(metadata),
    );

    const staged = metadata as StagedMetadata;
    expect(staged.view!.aggregates).toHaveLength(2);
    expect(staged.view!.aggregates[0]).toBe(FakeAggregateA);
    expect(staged.view!.aggregates[1]).toBe(FakeAggregateB);
  });

  test("should stage view metadata with custom driverType string", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeAggregate {}
    class FakeEntity {}
    class TestView {}

    View(FakeAggregate, FakeEntity, "postgres")(TestView, createMockContext(metadata));

    const staged = metadata as StagedMetadata;
    expect(staged.view!.driverType).toBe("postgres");
  });

  test("should derive name from entity class when no @Entity metadata", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeAggregate {}
    class OrderSummaryEntity {}
    class OrderSummaryView {}

    View(FakeAggregate, OrderSummaryEntity)(
      OrderSummaryView,
      createMockContext(metadata),
    );

    const staged = metadata as StagedMetadata;
    expect(staged.view!.name).toBe("order_summary_entity");
  });

  test("should derive name from entity @Entity metadata when present", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeAggregate {}
    class OrderSummaryEntity {}
    // Simulate @Entity({ name: "order_summary" }) metadata
    (OrderSummaryEntity as any)[Symbol.metadata] = { entity: { name: "order_summary" } };
    class OrderSummaryView {}

    View(FakeAggregate, OrderSummaryEntity)(
      OrderSummaryView,
      createMockContext(metadata),
    );

    const staged = metadata as StagedMetadata;
    expect(staged.view!.name).toBe("order_summary");
  });
});
