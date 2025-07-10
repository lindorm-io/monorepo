import { Dict } from "@lindorm/types";
import {
  Saga,
  SagaEventCtx,
  SagaEventHandler,
  SagaTimeoutCtx,
  SagaTimeoutHandler,
} from "../../../src";
import { ExampleAggregate } from "../aggregates/ExampleAggregate";
import { ExampleCommandMergeState } from "../commands/ExampleCommandMergeState";
import { ExampleEventCreate } from "../events/ExampleEventCreate";
import { ExampleEventDestroy } from "../events/ExampleEventDestroy";
import { ExampleEventDestroyNext } from "../events/ExampleEventDestroyNext";
import { ExampleEventDispatch } from "../events/ExampleEventDispatch";
import { ExampleEventEncrypt } from "../events/ExampleEventEncrypt";
import { ExampleEventMergeState } from "../events/ExampleEventMergeState";
import { ExampleEventSetState } from "../events/ExampleEventSetState";
import { ExampleEventThrows } from "../events/ExampleEventThrows";
import { ExampleEventTimeout } from "../events/ExampleEventTimeout";
import { ExampleTimeoutDestroy } from "../timeouts/ExampleTimeoutDestroy";
import { ExampleTimeoutDispatch } from "../timeouts/ExampleTimeoutDispatch";
import { ExampleTimeoutMergeState } from "../timeouts/ExampleTimeoutMergeState";
import { ExampleTimeoutSetState } from "../timeouts/ExampleTimeoutSetState";
import { ExampleTimeoutThrows } from "../timeouts/ExampleTimeoutThrows";

export type ExampleSagaState = Dict;

@Saga(ExampleAggregate)
export class ExampleSaga {
  // event handlers

  @SagaEventHandler(ExampleEventCreate, { conditions: { created: false } })
  public async onCreateEvent(
    ctx: SagaEventCtx<ExampleEventCreate, ExampleSagaState>,
  ): Promise<void> {
    ctx.mergeState({ create: ctx.event.input });
  }

  @SagaEventHandler(ExampleEventDestroy, { conditions: { created: true } })
  public async onDestroyEvent(
    ctx: SagaEventCtx<ExampleEventDestroy, ExampleSagaState>,
  ): Promise<void> {
    ctx.mergeState({ destroy: ctx.event.input });
    ctx.destroy();
  }

  @SagaEventHandler(ExampleEventDestroyNext)
  public async onDestroyNextEvent(
    ctx: SagaEventCtx<ExampleEventDestroyNext, ExampleSagaState>,
  ): Promise<void> {
    ctx.mergeState({ destroyNext: ctx.event.input });
  }

  @SagaEventHandler(ExampleEventDispatch)
  public async onDispatchEvent(
    ctx: SagaEventCtx<ExampleEventDispatch, ExampleSagaState>,
  ): Promise<void> {
    ctx.mergeState({ dispatch: ctx.event.input });
    ctx.dispatch(new ExampleCommandMergeState(ctx.event.input));
  }

  @SagaEventHandler(ExampleEventEncrypt)
  public async onEncryptEvent(
    ctx: SagaEventCtx<ExampleEventEncrypt, ExampleSagaState>,
  ): Promise<void> {
    ctx.mergeState({ encrypt: ctx.event.input });
  }

  @SagaEventHandler(ExampleEventMergeState)
  public async onMergeStateEvent(
    ctx: SagaEventCtx<ExampleEventMergeState, ExampleSagaState>,
  ): Promise<void> {
    ctx.mergeState({ mergeState: ctx.event.input });
  }

  @SagaEventHandler(ExampleEventSetState)
  public async onSetStateEvent(
    ctx: SagaEventCtx<ExampleEventSetState, ExampleSagaState>,
  ): Promise<void> {
    ctx.setState({
      ...ctx.state,
      setState: ctx.event.input,
    });
  }

  @SagaEventHandler(ExampleEventThrows)
  public async onThrowsEvent(
    ctx: SagaEventCtx<ExampleEventThrows, ExampleSagaState>,
  ): Promise<void> {
    throw new Error(ctx.event.input);
  }

  @SagaEventHandler(ExampleEventTimeout)
  public async onTimeoutEvent(
    ctx: SagaEventCtx<ExampleEventTimeout, ExampleSagaState>,
  ): Promise<void> {
    ctx.mergeState({ timeout: ctx.event.input });
    ctx.dispatch(new ExampleTimeoutMergeState(ctx.event.input));
  }

  // timeout handlers

  @SagaTimeoutHandler(ExampleTimeoutDestroy)
  public async onDestroyTimeout(
    ctx: SagaTimeoutCtx<ExampleTimeoutDestroy, ExampleSagaState>,
  ): Promise<void> {
    ctx.mergeState({ destroyTimeout: ctx.timeout.input });
    ctx.destroy();
  }

  @SagaTimeoutHandler(ExampleTimeoutDispatch)
  public async onDispatchTimeout(
    ctx: SagaTimeoutCtx<ExampleTimeoutDispatch, ExampleSagaState>,
  ): Promise<void> {
    ctx.mergeState({ dispatchTimeout: ctx.timeout.input });
    ctx.dispatch(new ExampleCommandMergeState(ctx.timeout.input));
  }

  @SagaTimeoutHandler(ExampleTimeoutMergeState)
  public async onMergeStateTimeout(
    ctx: SagaTimeoutCtx<ExampleTimeoutMergeState, ExampleSagaState>,
  ): Promise<void> {
    ctx.mergeState({ mergeStateTimeout: ctx.timeout.input });
  }

  @SagaTimeoutHandler(ExampleTimeoutSetState)
  public async onSetStateTimeout(
    ctx: SagaTimeoutCtx<ExampleTimeoutSetState, ExampleSagaState>,
  ): Promise<void> {
    ctx.setState({
      ...ctx.state,
      setStateTimeout: ctx.timeout.input,
    });
  }

  @SagaTimeoutHandler(ExampleTimeoutThrows)
  public async onThrowsTimeout(
    ctx: SagaTimeoutCtx<ExampleTimeoutThrows, ExampleSagaState>,
  ): Promise<void> {
    throw new Error(ctx.timeout.input);
  }
}
