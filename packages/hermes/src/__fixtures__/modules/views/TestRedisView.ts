import { Dict } from "@lindorm/types";
import {
  View,
  ViewErrorHandler,
  ViewEventHandler,
  ViewQueryHandler,
} from "../../../decorators";
import { DomainError } from "../../../errors";
import { ViewErrorCtx, ViewEventCtx, ViewQueryCtx } from "../../../types";
import { TestAggregate } from "../aggregates/TestAggregate";
import { TestEventCreate } from "../events/TestEventCreate";
import { TestEventDestroy } from "../events/TestEventDestroy";
import { TestEventDestroyNext } from "../events/TestEventDestroyNext";
import { TestEventDispatch } from "../events/TestEventDispatch";
import { TestEventEncrypt } from "../events/TestEventEncrypt";
import { TestEventMergeState } from "../events/TestEventMergeState";
import { TestEventSetState } from "../events/TestEventSetState";
import { TestEventThrows } from "../events/TestEventThrows";
import { TestEventTimeout } from "../events/TestEventTimeout";
import { TestRedisQuery } from "../queries/TestQueryRedis";

export type TestRedisViewState = Dict;

@View(TestAggregate, "redis")
export class TestRedisView {
  // event handlers

  @ViewEventHandler(TestEventCreate, { conditions: { created: false } })
  public async onCreateEvent(
    ctx: ViewEventCtx<TestEventCreate, TestRedisViewState>,
  ): Promise<void> {
    ctx.mergeState({ create: ctx.event.input });
  }

  @ViewEventHandler(TestEventDestroy, { conditions: { created: true } })
  public async onDestroyEvent(
    ctx: ViewEventCtx<TestEventDestroy, TestRedisViewState>,
  ): Promise<void> {
    ctx.mergeState({ destroy: ctx.event.input });
    ctx.destroy();
  }

  @ViewEventHandler(TestEventDestroyNext, { conditions: { created: true } })
  public async onDestroyNextEvent(
    ctx: ViewEventCtx<TestEventDestroyNext, TestRedisViewState>,
  ): Promise<void> {
    ctx.mergeState({ destroyNext: ctx.event.input });
  }

  @ViewEventHandler(TestEventDispatch)
  public async onDispatchEvent(
    ctx: ViewEventCtx<TestEventDispatch, TestRedisViewState>,
  ): Promise<void> {
    ctx.mergeState({ dispatch: ctx.event.input });
  }

  @ViewEventHandler(TestEventEncrypt)
  public async onEncryptEvent(
    ctx: ViewEventCtx<TestEventEncrypt, TestRedisViewState>,
  ): Promise<void> {
    ctx.mergeState({ encrypt: ctx.event.input });
  }

  @ViewEventHandler(TestEventMergeState)
  public async onMergeStateEvent(
    ctx: ViewEventCtx<TestEventMergeState, TestRedisViewState>,
  ): Promise<void> {
    ctx.mergeState({ mergeState: ctx.event.input });
  }

  @ViewEventHandler(TestEventSetState)
  public async onSetStateEvent(
    ctx: ViewEventCtx<TestEventSetState, TestRedisViewState>,
  ): Promise<void> {
    ctx.setState({
      ...ctx.state,
      setState: ctx.event.input,
    });
  }

  @ViewEventHandler(TestEventThrows)
  public async onThrowsEvent(
    ctx: ViewEventCtx<TestEventThrows, TestRedisViewState>,
  ): Promise<void> {
    throw new Error(ctx.event.input);
  }

  @ViewEventHandler(TestEventTimeout)
  public async onTimeoutEvent(
    ctx: ViewEventCtx<TestEventTimeout, TestRedisViewState>,
  ): Promise<void> {
    ctx.mergeState({ timeout: ctx.event.input });
  }

  // query handlers

  @ViewQueryHandler(TestRedisQuery)
  public async onRedisQuery(
    ctx: ViewQueryCtx<TestRedisQuery, TestRedisViewState>,
  ): Promise<Dict | undefined> {
    return await ctx.repositories.redis.findById(ctx.query.id);
  }

  // error handlers

  @ViewErrorHandler(DomainError)
  public async onDomainError(ctx: ViewErrorCtx<DomainError>): Promise<void> {
    ctx.logger.warn("DomainError", {
      event: ctx.event,
      error: ctx.error,
      message: ctx.message,
      view: ctx.view,
    });
  }
}
