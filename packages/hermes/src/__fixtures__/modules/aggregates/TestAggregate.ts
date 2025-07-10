import { Dict } from "@lindorm/types";
import z from "zod";
import {
  Aggregate,
  AggregateCommandHandler,
  AggregateErrorHandler,
  AggregateEventHandler,
} from "../../../decorators";
import { DomainError } from "../../../errors";
import {
  AggregateCommandCtx,
  AggregateErrorCtx,
  AggregateEventCtx,
} from "../../../types";
import { TestCommandCreate } from "../commands/TestCommandCreate";
import { TestCommandDestroy } from "../commands/TestCommandDestroy";
import { TestCommandDestroyNext } from "../commands/TestCommandDestroyNext";
import { TestCommandDispatch } from "../commands/TestCommandDispatch";
import { TestCommandEncrypt } from "../commands/TestCommandEncrypt";
import { TestCommandMergeState } from "../commands/TestCommandMergeState";
import { TestCommandSetState } from "../commands/TestCommandSetState";
import { TestCommandThrows } from "../commands/TestCommandThrows";
import { TestCommandTimeout } from "../commands/TestCommandTimeout";
import { TestEventCreate } from "../events/TestEventCreate";
import { TestEventDestroy } from "../events/TestEventDestroy";
import { TestEventDestroyNext } from "../events/TestEventDestroyNext";
import { TestEventDispatch } from "../events/TestEventDispatch";
import { TestEventEncrypt } from "../events/TestEventEncrypt";
import { TestEventMergeState } from "../events/TestEventMergeState";
import { TestEventSetState } from "../events/TestEventSetState";
import { TestEventThrows } from "../events/TestEventThrows";
import { TestEventTimeout } from "../events/TestEventTimeout";

export type TestAggregateState = Dict;

@Aggregate()
export class TestAggregate {
  // command handlers

  @AggregateCommandHandler(TestCommandCreate, {
    conditions: { created: false },
    schema: z.object({ input: z.string() }),
  })
  public async onCreate(
    ctx: AggregateCommandCtx<TestCommandCreate, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventCreate("create"));
  }

  @AggregateCommandHandler(TestCommandDestroy, { conditions: { created: true } })
  public async onDestroy(
    ctx: AggregateCommandCtx<TestCommandDestroy, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventDestroy("destroy"));
  }

  @AggregateCommandHandler(TestCommandDestroyNext)
  public async onDestroyNext(
    ctx: AggregateCommandCtx<TestCommandDestroyNext, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventDestroyNext("destroy next"));
  }

  @AggregateCommandHandler(TestCommandDispatch)
  public async onDispatch(
    ctx: AggregateCommandCtx<TestCommandDispatch, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventDispatch("dispatch"));
  }

  @AggregateCommandHandler(TestCommandEncrypt, { encryption: true })
  public async onEncrypt(
    ctx: AggregateCommandCtx<TestCommandEncrypt, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventEncrypt("encrypt"));
  }

  @AggregateCommandHandler(TestCommandMergeState)
  public async onMergeState(
    ctx: AggregateCommandCtx<TestCommandMergeState, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventMergeState("merge state"));
  }

  @AggregateCommandHandler(TestCommandSetState)
  public async onSetState(
    ctx: AggregateCommandCtx<TestCommandSetState, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventSetState("set state"));
  }

  @AggregateCommandHandler(TestCommandThrows)
  public async onThrows(
    ctx: AggregateCommandCtx<TestCommandThrows, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventThrows("throws"));
  }

  @AggregateCommandHandler(TestCommandTimeout)
  public async onTimeout(
    ctx: AggregateCommandCtx<TestCommandTimeout, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventTimeout("timeout"));
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
    ctx.setState({
      ...ctx.state,
      setState: ctx.event.input,
    });
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
  public async onDomainError(ctx: AggregateErrorCtx<DomainError>): Promise<void> {
    ctx.logger.warn("DomainError", {
      command: ctx.command,
      error: ctx.error,
      message: ctx.message,
    });
  }
}
