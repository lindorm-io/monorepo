import type { Dict } from "@lindorm/types";
import {
  RequireCreated,
  RequireNotCreated,
  Saga,
  SagaErrorHandler,
  SagaEventHandler,
  SagaIdHandler,
  SagaTimeoutHandler,
} from "../../../decorators";
import { DomainError } from "../../../errors";
import type {
  SagaErrorCtx,
  SagaEventCtx,
  SagaIdCtx,
  SagaTimeoutCtx,
} from "../../../types";
import { TestAggregate } from "../aggregates/TestAggregate";
import { TestCommandCreate } from "../commands/TestCommandCreate";
import { TestCommandMergeState } from "../commands/TestCommandMergeState";
import { TestEventCreate } from "../events/TestEventCreate";
import { TestEventDestroy } from "../events/TestEventDestroy";
import { TestEventDispatch } from "../events/TestEventDispatch";
import { TestEventMergeState } from "../events/TestEventMergeState";
import { TestEventThrows } from "../events/TestEventThrows";
import { TestTimeoutReminder } from "../timeouts/TestTimeoutReminder";

export type TestSagaState = Dict;

@Saga(TestAggregate)
export class TestSaga {
  // event handlers

  @SagaEventHandler(TestEventCreate)
  @RequireNotCreated()
  public async onCreateEvent(
    ctx: SagaEventCtx<TestEventCreate, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ create: ctx.event.input });
  }

  @SagaEventHandler(TestEventMergeState)
  @RequireCreated()
  public async onMergeStateEvent(
    ctx: SagaEventCtx<TestEventMergeState, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ mergeState: ctx.event.input });
    ctx.dispatch(new TestCommandMergeState(ctx.event.input), { delay: 100 });
  }

  @SagaEventHandler(TestEventDispatch)
  @RequireCreated()
  public async onDispatchEvent(
    ctx: SagaEventCtx<TestEventDispatch, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ dispatch: ctx.event.input });
    ctx.dispatch(new TestCommandMergeState("from-saga"));
  }

  @SagaEventHandler(TestEventThrows)
  @RequireCreated()
  public async onThrowsEvent(
    ctx: SagaEventCtx<TestEventThrows, TestSagaState>,
  ): Promise<void> {
    throw new Error(ctx.event.input);
  }

  @SagaEventHandler(TestEventDestroy)
  @RequireCreated()
  public async onDestroyEvent(
    ctx: SagaEventCtx<TestEventDestroy, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ destroy: ctx.event.input });
    ctx.destroy();
  }

  // id handler

  @SagaIdHandler(TestEventCreate)
  public resolveId(ctx: SagaIdCtx<TestEventCreate>): string {
    return ctx.aggregate.id;
  }

  // timeout handler

  @SagaTimeoutHandler(TestTimeoutReminder)
  public async onTimeout(
    ctx: SagaTimeoutCtx<TestTimeoutReminder, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ timeout: true });
  }

  // error handler

  @SagaErrorHandler(DomainError)
  public async onDomainError(ctx: SagaErrorCtx): Promise<void> {
    ctx.dispatch(new TestCommandCreate("recovery"));
  }
}
