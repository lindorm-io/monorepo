import type { Dict } from "@lindorm/types";
import { z } from "zod";
import {
  Aggregate,
  AggregateCommandHandler,
  AggregateErrorHandler,
  AggregateEventHandler,
  RequireCreated,
  RequireNotCreated,
  Validate,
} from "../../../decorators/index.js";
import { DomainError } from "../../../errors/index.js";
import type {
  AggregateCommandCtx,
  AggregateErrorCtx,
  AggregateEventCtx,
} from "../../../types/index.js";
import { TestCommandCreate } from "../commands/TestCommandCreate.js";
import { TestCommandDestroy } from "../commands/TestCommandDestroy.js";
import { TestCommandDestroyNext } from "../commands/TestCommandDestroyNext.js";
import { TestCommandDispatch } from "../commands/TestCommandDispatch.js";
import { TestCommandEncrypt } from "../commands/TestCommandEncrypt.js";
import { TestCommandMergeState } from "../commands/TestCommandMergeState.js";
import { TestCommandSetState } from "../commands/TestCommandSetState.js";
import { TestCommandThrows } from "../commands/TestCommandThrows.js";
import { TestCommandTimeout } from "../commands/TestCommandTimeout.js";
import { TestEventCreate } from "../events/TestEventCreate.js";
import { TestEventDestroy } from "../events/TestEventDestroy.js";
import { TestEventDestroyNext } from "../events/TestEventDestroyNext.js";
import { TestEventDispatch } from "../events/TestEventDispatch.js";
import { TestEventEncrypt } from "../events/TestEventEncrypt.js";
import { TestEventMergeState } from "../events/TestEventMergeState.js";
import { TestEventSetState } from "../events/TestEventSetState.js";
import { TestEventThrows } from "../events/TestEventThrows.js";
import { TestEventTimeout } from "../events/TestEventTimeout.js";

export type TestAggregateState = Dict;

@Aggregate()
export class TestAggregate {
  // command handlers

  @AggregateCommandHandler(TestCommandCreate)
  @RequireNotCreated()
  @Validate(z.object({ input: z.string() }))
  public async onCreate(
    ctx: AggregateCommandCtx<TestCommandCreate, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventCreate(ctx.command.input));
  }

  @AggregateCommandHandler(TestCommandDestroy)
  @RequireCreated()
  public async onDestroy(
    ctx: AggregateCommandCtx<TestCommandDestroy, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventDestroy(ctx.command.input));
  }

  @AggregateCommandHandler(TestCommandDestroyNext)
  @RequireCreated()
  public async onDestroyNext(
    ctx: AggregateCommandCtx<TestCommandDestroyNext, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventDestroyNext(ctx.command.input));
    await ctx.apply(new TestEventDestroy(ctx.command.input));
  }

  @AggregateCommandHandler(TestCommandDispatch)
  @RequireCreated()
  public async onDispatch(
    ctx: AggregateCommandCtx<TestCommandDispatch, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventDispatch(ctx.command.input));
  }

  @AggregateCommandHandler(TestCommandEncrypt)
  @RequireCreated()
  public async onEncrypt(
    ctx: AggregateCommandCtx<TestCommandEncrypt, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventEncrypt(ctx.command.input));
  }

  @AggregateCommandHandler(TestCommandMergeState)
  @RequireCreated()
  public async onMergeState(
    ctx: AggregateCommandCtx<TestCommandMergeState, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventMergeState(ctx.command.input));
  }

  @AggregateCommandHandler(TestCommandSetState)
  @RequireCreated()
  public async onSetState(
    ctx: AggregateCommandCtx<TestCommandSetState, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventSetState(ctx.command.input));
  }

  @AggregateCommandHandler(TestCommandThrows)
  @RequireCreated()
  public async onThrows(
    ctx: AggregateCommandCtx<TestCommandThrows, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventThrows(ctx.command.input));
  }

  @AggregateCommandHandler(TestCommandTimeout)
  @RequireCreated()
  public async onTimeout(
    ctx: AggregateCommandCtx<TestCommandTimeout, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventTimeout(ctx.command.input));
  }

  // event handlers

  @AggregateEventHandler(TestEventCreate)
  public async onCreateEvent(
    ctx: AggregateEventCtx<TestEventCreate, TestAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ create: ctx.event.input });
  }

  @AggregateEventHandler(TestEventDestroy)
  public async onDestroyEvent(
    ctx: AggregateEventCtx<TestEventDestroy, TestAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ destroy: ctx.event.input });
    ctx.destroy();
  }

  @AggregateEventHandler(TestEventDestroyNext)
  public async onDestroyNextEvent(
    ctx: AggregateEventCtx<TestEventDestroyNext, TestAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ destroyNext: ctx.event.input });
    ctx.destroyNext();
  }

  @AggregateEventHandler(TestEventDispatch)
  public async onDispatchEvent(
    ctx: AggregateEventCtx<TestEventDispatch, TestAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ dispatch: ctx.event.input });
  }

  @AggregateEventHandler(TestEventEncrypt)
  public async onEncryptEvent(
    ctx: AggregateEventCtx<TestEventEncrypt, TestAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ encrypt: ctx.event.input });
  }

  @AggregateEventHandler(TestEventMergeState)
  public async onMergeStateEvent(
    ctx: AggregateEventCtx<TestEventMergeState, TestAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ mergeState: ctx.event.input });
  }

  @AggregateEventHandler(TestEventSetState)
  public async onSetStateEvent(
    ctx: AggregateEventCtx<TestEventSetState, TestAggregateState>,
  ): Promise<void> {
    ctx.setState({ ...ctx.state, setState: ctx.event.input });
  }

  @AggregateEventHandler(TestEventThrows)
  public async onThrowsEvent(
    ctx: AggregateEventCtx<TestEventThrows, TestAggregateState>,
  ): Promise<void> {
    throw new Error(ctx.event.input);
  }

  @AggregateEventHandler(TestEventTimeout)
  public async onTimeoutEvent(
    ctx: AggregateEventCtx<TestEventTimeout, TestAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ timeout: ctx.event.input });
  }

  // error handlers

  @AggregateErrorHandler(DomainError)
  public async onDomainError(ctx: AggregateErrorCtx): Promise<void> {
    ctx.dispatch(new TestCommandCreate("retry"));
  }
}
