import type { Dict } from "@lindorm/types";
import {
  Aggregate,
  AggregateCommandHandler,
  AggregateEventHandler,
  Forgettable,
  Namespace,
  RequireNotCreated,
} from "../../../decorators/index.js";
import type { AggregateCommandCtx, AggregateEventCtx } from "../../../types/index.js";
import { TestCommandCreate } from "../commands/TestCommandCreate.js";
import { TestEventCreate } from "../events/TestEventCreate.js";

export type TestForgettableAggregateState = Dict;

@Aggregate()
@Namespace("billing")
@Forgettable()
export class TestForgettableAggregate {
  @AggregateCommandHandler(TestCommandCreate)
  @RequireNotCreated()
  public async onCreate(
    ctx: AggregateCommandCtx<TestCommandCreate, TestForgettableAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventCreate(ctx.command.input));
  }

  @AggregateEventHandler(TestEventCreate)
  public async onCreateEvent(
    ctx: AggregateEventCtx<TestEventCreate, TestForgettableAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ create: ctx.event.input });
  }
}
