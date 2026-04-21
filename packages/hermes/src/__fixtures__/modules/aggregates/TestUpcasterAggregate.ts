import type { Dict } from "@lindorm/types";
import {
  Aggregate,
  AggregateCommandHandler,
  AggregateEventHandler,
  EventUpcaster,
} from "../../../decorators/index.js";
import type { AggregateCommandCtx, AggregateEventCtx } from "../../../types/index.js";
import { TestCommandCreate } from "../commands/TestCommandCreate.js";
import { TestEventCreate } from "../events/TestEventCreate.js";
import { TestEventUpcast_V1 } from "../events/TestEventUpcast_V1.js";
import { TestEventUpcast_V2 } from "../events/TestEventUpcast_V2.js";
import { TestEventUpcast_V3 } from "../events/TestEventUpcast_V3.js";

export type TestUpcasterAggregateState = Dict;

@Aggregate()
export class TestUpcasterAggregate {
  @AggregateCommandHandler(TestCommandCreate)
  public async onCreate(
    ctx: AggregateCommandCtx<TestCommandCreate, TestUpcasterAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventCreate(ctx.command.input));
  }

  @AggregateEventHandler(TestEventCreate)
  public async onCreateEvent(
    ctx: AggregateEventCtx<TestEventCreate, TestUpcasterAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ create: ctx.event.input });
  }

  // The handler expects V3; stored V1/V2 events will be upcasted to V3
  @AggregateEventHandler(TestEventUpcast_V3)
  public async onUpcastEvent(
    ctx: AggregateEventCtx<TestEventUpcast_V3, TestUpcasterAggregateState>,
  ): Promise<void> {
    ctx.mergeState({
      value: ctx.event.value,
      addedField: ctx.event.addedField,
      extraField: ctx.event.extraField,
    });
  }

  // Upcaster chain: V1 -> V2 -> V3

  @EventUpcaster(TestEventUpcast_V1, TestEventUpcast_V2)
  public upcastV1toV2(event: TestEventUpcast_V1): TestEventUpcast_V2 {
    return new TestEventUpcast_V2(event.value, 0);
  }

  @EventUpcaster(TestEventUpcast_V2, TestEventUpcast_V3)
  public upcastV2toV3(event: TestEventUpcast_V2): TestEventUpcast_V3 {
    return new TestEventUpcast_V3(event.value, event.addedField, false);
  }
}
