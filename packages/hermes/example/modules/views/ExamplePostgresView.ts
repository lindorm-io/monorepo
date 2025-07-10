import { Dict } from "@lindorm/types";
import { View, ViewEventHandler, ViewQueryHandler } from "../../../src";
import { ViewEventCtx, ViewQueryCtx } from "../../../src";
import { ExampleAggregate } from "../aggregates/ExampleAggregate";
import { ExampleEventCreate } from "../events/ExampleEventCreate";
import { ExampleEventDestroy } from "../events/ExampleEventDestroy";
import { ExampleEventDestroyNext } from "../events/ExampleEventDestroyNext";
import { ExampleEventDispatch } from "../events/ExampleEventDispatch";
import { ExampleEventEncrypt } from "../events/ExampleEventEncrypt";
import { ExampleEventMergeState } from "../events/ExampleEventMergeState";
import { ExampleEventSetState } from "../events/ExampleEventSetState";
import { ExampleEventThrows } from "../events/ExampleEventThrows";
import { ExampleEventTimeout } from "../events/ExampleEventTimeout";
import { ExamplePostgresQuery } from "../queries/ExampleQueryPostgres";

export type ExamplePostgresViewState = Dict;

@View(ExampleAggregate, "postgres")
export class ExamplePostgresView {
  // event handlers

  @ViewEventHandler(ExampleEventCreate, { conditions: { created: false } })
  public async onCreateEvent(
    ctx: ViewEventCtx<ExampleEventCreate, ExamplePostgresViewState>,
  ): Promise<void> {
    ctx.mergeState({ create: ctx.event.input });
  }

  @ViewEventHandler(ExampleEventDestroy, { conditions: { created: true } })
  public async onDestroyEvent(
    ctx: ViewEventCtx<ExampleEventDestroy, ExamplePostgresViewState>,
  ): Promise<void> {
    ctx.mergeState({ destroy: ctx.event.input });
    ctx.destroy();
  }

  @ViewEventHandler(ExampleEventDestroyNext, { conditions: { created: true } })
  public async onDestroyNextEvent(
    ctx: ViewEventCtx<ExampleEventDestroyNext, ExamplePostgresViewState>,
  ): Promise<void> {
    ctx.mergeState({ destroyNext: ctx.event.input });
  }

  @ViewEventHandler(ExampleEventDispatch)
  public async onDispatchEvent(
    ctx: ViewEventCtx<ExampleEventDispatch, ExamplePostgresViewState>,
  ): Promise<void> {
    ctx.mergeState({ dispatch: ctx.event.input });
  }

  @ViewEventHandler(ExampleEventEncrypt)
  public async onEncryptEvent(
    ctx: ViewEventCtx<ExampleEventEncrypt, ExamplePostgresViewState>,
  ): Promise<void> {
    ctx.mergeState({ encrypt: ctx.event.input });
  }

  @ViewEventHandler(ExampleEventMergeState)
  public async onMergeStateEvent(
    ctx: ViewEventCtx<ExampleEventMergeState, ExamplePostgresViewState>,
  ): Promise<void> {
    ctx.mergeState({ mergeState: ctx.event.input });
  }

  @ViewEventHandler(ExampleEventSetState)
  public async onSetStateEvent(
    ctx: ViewEventCtx<ExampleEventSetState, ExamplePostgresViewState>,
  ): Promise<void> {
    ctx.setState({
      ...ctx.state,
      setState: ctx.event.input,
    });
  }

  @ViewEventHandler(ExampleEventThrows)
  public async onThrowsEvent(
    ctx: ViewEventCtx<ExampleEventThrows, ExamplePostgresViewState>,
  ): Promise<void> {
    throw new Error(ctx.event.input);
  }

  @ViewEventHandler(ExampleEventTimeout)
  public async onTimeoutEvent(
    ctx: ViewEventCtx<ExampleEventTimeout, ExamplePostgresViewState>,
  ): Promise<void> {
    ctx.mergeState({ timeout: ctx.event.input });
  }

  // query handlers

  @ViewQueryHandler(ExamplePostgresQuery)
  public async onPostgresQuery(
    ctx: ViewQueryCtx<ExamplePostgresQuery, ExamplePostgresViewState>,
  ): Promise<Dict | undefined> {
    return await ctx.repositories.postgres.findById(ctx.query.id);
  }
}
