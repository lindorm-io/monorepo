import { Dict } from "@lindorm/types";
import z from "zod";
import { DomainError } from "../../../dist";
import {
  Aggregate,
  AggregateCommandCtx,
  AggregateCommandHandler,
  AggregateErrorCtx,
  AggregateErrorHandler,
  AggregateEventCtx,
  AggregateEventHandler,
} from "../../../src";
import { ExampleCommandCreate } from "../commands/ExampleCommandCreate";
import { ExampleCommandDestroy } from "../commands/ExampleCommandDestroy";
import { ExampleCommandDestroyNext } from "../commands/ExampleCommandDestroyNext";
import { ExampleCommandDispatch } from "../commands/ExampleCommandDispatch";
import { ExampleCommandEncrypt } from "../commands/ExampleCommandEncrypt";
import { ExampleCommandMergeState } from "../commands/ExampleCommandMergeState";
import { ExampleCommandSetState } from "../commands/ExampleCommandSetState";
import { ExampleCommandThrows } from "../commands/ExampleCommandThrows";
import { ExampleCommandTimeout } from "../commands/ExampleCommandTimeout";
import { ExampleEventCreate } from "../events/ExampleEventCreate";
import { ExampleEventDestroy } from "../events/ExampleEventDestroy";
import { ExampleEventDestroyNext } from "../events/ExampleEventDestroyNext";
import { ExampleEventDispatch } from "../events/ExampleEventDispatch";
import { ExampleEventEncrypt } from "../events/ExampleEventEncrypt";
import { ExampleEventMergeState } from "../events/ExampleEventMergeState";
import { ExampleEventSetState } from "../events/ExampleEventSetState";
import { ExampleEventThrows } from "../events/ExampleEventThrows";
import { ExampleEventTimeout } from "../events/ExampleEventTimeout";

export type ExampleAggregateState = Dict;

@Aggregate()
export class ExampleAggregate {
  // command handlers

  @AggregateCommandHandler(ExampleCommandCreate, {
    conditions: { created: false },
    schema: z.object({ input: z.string() }),
  })
  public async onCreate(
    ctx: AggregateCommandCtx<ExampleCommandCreate, ExampleAggregateState>,
  ): Promise<void> {
    await ctx.apply(new ExampleEventCreate("create"));
  }

  @AggregateCommandHandler(ExampleCommandDestroy, { conditions: { created: true } })
  public async onDestroy(
    ctx: AggregateCommandCtx<ExampleCommandDestroy, ExampleAggregateState>,
  ): Promise<void> {
    await ctx.apply(new ExampleEventDestroy("destroy"));
  }

  @AggregateCommandHandler(ExampleCommandDestroyNext)
  public async onDestroyNext(
    ctx: AggregateCommandCtx<ExampleCommandDestroyNext, ExampleAggregateState>,
  ): Promise<void> {
    await ctx.apply(new ExampleEventDestroyNext("destroy next"));
  }

  @AggregateCommandHandler(ExampleCommandDispatch)
  public async onDispatch(
    ctx: AggregateCommandCtx<ExampleCommandDispatch, ExampleAggregateState>,
  ): Promise<void> {
    await ctx.apply(new ExampleEventDispatch("dispatch"));
  }

  @AggregateCommandHandler(ExampleCommandEncrypt, { encryption: true })
  public async onEncrypt(
    ctx: AggregateCommandCtx<ExampleCommandEncrypt, ExampleAggregateState>,
  ): Promise<void> {
    await ctx.apply(new ExampleEventEncrypt("encrypt"));
  }

  @AggregateCommandHandler(ExampleCommandMergeState)
  public async onMergeState(
    ctx: AggregateCommandCtx<ExampleCommandMergeState, ExampleAggregateState>,
  ): Promise<void> {
    await ctx.apply(new ExampleEventMergeState("merge state"));
  }

  @AggregateCommandHandler(ExampleCommandSetState)
  public async onSetState(
    ctx: AggregateCommandCtx<ExampleCommandSetState, ExampleAggregateState>,
  ): Promise<void> {
    await ctx.apply(new ExampleEventSetState("set state"));
  }

  @AggregateCommandHandler(ExampleCommandThrows)
  public async onThrows(
    ctx: AggregateCommandCtx<ExampleCommandThrows, ExampleAggregateState>,
  ): Promise<void> {
    await ctx.apply(new ExampleEventThrows("throws"));
  }

  @AggregateCommandHandler(ExampleCommandTimeout)
  public async onTimeout(
    ctx: AggregateCommandCtx<ExampleCommandTimeout, ExampleAggregateState>,
  ): Promise<void> {
    await ctx.apply(new ExampleEventTimeout("timeout"));
  }

  // event handlers

  @AggregateEventHandler(ExampleEventCreate)
  public async onCreateEvent(
    ctx: AggregateEventCtx<ExampleEventCreate, ExampleAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ create: ctx.event.input });
  }

  @AggregateEventHandler(ExampleEventDestroy)
  public async onDestroyEvent(
    ctx: AggregateEventCtx<ExampleEventDestroy, ExampleAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ destroy: ctx.event.input });
    ctx.destroy();
  }

  @AggregateEventHandler(ExampleEventDestroyNext)
  public async onDestroyNextEvent(
    ctx: AggregateEventCtx<ExampleEventDestroyNext, ExampleAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ destroyNext: ctx.event.input });
    ctx.destroyNext();
  }

  @AggregateEventHandler(ExampleEventDispatch)
  public async onDispatchEvent(
    ctx: AggregateEventCtx<ExampleEventDispatch, ExampleAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ dispatch: ctx.event.input });
  }

  @AggregateEventHandler(ExampleEventEncrypt)
  public async onEncryptEvent(
    ctx: AggregateEventCtx<ExampleEventEncrypt, ExampleAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ encrypt: ctx.event.input });
  }

  @AggregateEventHandler(ExampleEventMergeState)
  public async onMergeStateEvent(
    ctx: AggregateEventCtx<ExampleEventMergeState, ExampleAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ mergeState: ctx.event.input });
  }

  @AggregateEventHandler(ExampleEventSetState)
  public async onSetStateEvent(
    ctx: AggregateEventCtx<ExampleEventSetState, ExampleAggregateState>,
  ): Promise<void> {
    ctx.setState({
      ...ctx.state,
      setState: ctx.event.input,
    });
  }

  @AggregateEventHandler(ExampleEventThrows)
  public async onThrowsEvent(
    ctx: AggregateEventCtx<ExampleEventThrows, ExampleAggregateState>,
  ): Promise<void> {
    throw new Error(ctx.event.input);
  }

  @AggregateEventHandler(ExampleEventTimeout)
  public async onTimeoutEvent(
    ctx: AggregateEventCtx<ExampleEventTimeout, ExampleAggregateState>,
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
