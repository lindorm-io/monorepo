import type { Dict } from "@lindorm/types";
import {
  RequireCreated,
  RequireNotCreated,
  Saga,
  SagaErrorHandler,
  SagaEventHandler,
  SagaIdHandler,
  SagaTimeoutHandler,
} from "../../../decorators/index.js";
import { DomainError } from "../../../errors/index.js";
import type {
  SagaErrorCtx,
  SagaEventCtx,
  SagaIdCtx,
  SagaTimeoutCtx,
} from "../../../types/index.js";
import { TestAggregate } from "../aggregates/TestAggregate.js";
import { TestCommandCreate } from "../commands/TestCommandCreate.js";
import { TestCommandMergeState } from "../commands/TestCommandMergeState.js";
import { TestEventCreate } from "../events/TestEventCreate.js";
import { TestEventDestroy } from "../events/TestEventDestroy.js";
import { TestEventDispatch } from "../events/TestEventDispatch.js";
import { TestEventMergeState } from "../events/TestEventMergeState.js";
import { TestEventThrows } from "../events/TestEventThrows.js";
import { TestTimeoutReminder } from "../timeouts/TestTimeoutReminder.js";

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
