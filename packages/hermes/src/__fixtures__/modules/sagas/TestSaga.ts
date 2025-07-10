import { Dict } from "@lindorm/types";
import { Saga, SagaErrorHandler, SagaEventHandler } from "../../../decorators";
import { SagaTimeoutHandler } from "../../../decorators/SagaTimeoutHandler";
import { DomainError } from "../../../errors";
import { SagaErrorCtx, SagaEventCtx, SagaTimeoutCtx } from "../../../types";
import { TestAggregate } from "../aggregates/TestAggregate";
import { TestCommandMergeState } from "../commands/TestCommandMergeState";
import { TestEventCreate } from "../events/TestEventCreate";
import { TestEventDestroy } from "../events/TestEventDestroy";
import { TestEventDestroyNext } from "../events/TestEventDestroyNext";
import { TestEventDispatch } from "../events/TestEventDispatch";
import { TestEventEncrypt } from "../events/TestEventEncrypt";
import { TestEventMergeState } from "../events/TestEventMergeState";
import { TestEventSetState } from "../events/TestEventSetState";
import { TestEventThrows } from "../events/TestEventThrows";
import { TestEventTimeout } from "../events/TestEventTimeout";
import { TestTimeoutDestroy } from "../timeouts/TestTimeoutDestroy";
import { TestTimeoutDispatch } from "../timeouts/TestTimeoutDispatch";
import { TestTimeoutMergeState } from "../timeouts/TestTimeoutMergeState";
import { TestTimeoutSetState } from "../timeouts/TestTimeoutSetState";
import { TestTimeoutThrows } from "../timeouts/TestTimeoutThrows";

export type TestSagaState = Dict;

@Saga(TestAggregate)
export class TestSaga {
  // event handlers

  @SagaEventHandler(TestEventCreate, { conditions: { created: false } })
  public async onCreateEvent(
    ctx: SagaEventCtx<TestEventCreate, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ create: ctx.event.input });
  }

  @SagaEventHandler(TestEventDestroy, { conditions: { created: true } })
  public async onDestroyEvent(
    ctx: SagaEventCtx<TestEventDestroy, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ destroy: ctx.event.input });
    ctx.destroy();
  }

  @SagaEventHandler(TestEventDestroyNext)
  public async onDestroyNextEvent(
    ctx: SagaEventCtx<TestEventDestroyNext, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ destroyNext: ctx.event.input });
  }

  @SagaEventHandler(TestEventDispatch)
  public async onDispatchEvent(
    ctx: SagaEventCtx<TestEventDispatch, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ dispatch: ctx.event.input });
    ctx.dispatch(new TestCommandMergeState(ctx.event.input));
  }

  @SagaEventHandler(TestEventEncrypt)
  public async onEncryptEvent(
    ctx: SagaEventCtx<TestEventEncrypt, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ encrypt: ctx.event.input });
  }

  @SagaEventHandler(TestEventMergeState)
  public async onMergeStateEvent(
    ctx: SagaEventCtx<TestEventMergeState, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ mergeState: ctx.event.input });
  }

  @SagaEventHandler(TestEventSetState)
  public async onSetStateEvent(
    ctx: SagaEventCtx<TestEventSetState, TestSagaState>,
  ): Promise<void> {
    ctx.setState({
      ...ctx.state,
      setState: ctx.event.input,
    });
  }

  @SagaEventHandler(TestEventThrows)
  public async onThrowsEvent(
    ctx: SagaEventCtx<TestEventThrows, TestSagaState>,
  ): Promise<void> {
    throw new Error(ctx.event.input);
  }

  @SagaEventHandler(TestEventTimeout)
  public async onTimeoutEvent(
    ctx: SagaEventCtx<TestEventTimeout, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ timeout: ctx.event.input });
    ctx.dispatch(new TestTimeoutMergeState(ctx.event.input));
  }

  // timeout handlers

  @SagaTimeoutHandler(TestTimeoutDestroy)
  public async onDestroyTimeout(
    ctx: SagaTimeoutCtx<TestTimeoutDestroy, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ destroyTimeout: ctx.timeout.input });
    ctx.destroy();
  }

  @SagaTimeoutHandler(TestTimeoutDispatch)
  public async onDispatchTimeout(
    ctx: SagaTimeoutCtx<TestTimeoutDispatch, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ dispatchTimeout: ctx.timeout.input });
    ctx.dispatch(new TestCommandMergeState(ctx.timeout.input));
  }

  @SagaTimeoutHandler(TestTimeoutMergeState)
  public async onMergeStateTimeout(
    ctx: SagaTimeoutCtx<TestTimeoutMergeState, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ mergeStateTimeout: ctx.timeout.input });
  }

  @SagaTimeoutHandler(TestTimeoutSetState)
  public async onSetStateTimeout(
    ctx: SagaTimeoutCtx<TestTimeoutSetState, TestSagaState>,
  ): Promise<void> {
    ctx.setState({
      ...ctx.state,
      setStateTimeout: ctx.timeout.input,
    });
  }

  @SagaTimeoutHandler(TestTimeoutThrows)
  public async onThrowsTimeout(
    ctx: SagaTimeoutCtx<TestTimeoutThrows, TestSagaState>,
  ): Promise<void> {
    throw new Error(ctx.timeout.input);
  }

  // error handlers

  @SagaErrorHandler(DomainError)
  public async onDomainError(ctx: SagaErrorCtx<DomainError>): Promise<void> {
    ctx.logger.warn("DomainError", {
      event: ctx.event,
      error: ctx.error,
      message: ctx.message,
      saga: ctx.saga,
    });
  }
}
