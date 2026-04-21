import {
  RequireCreated,
  RequireNotCreated,
  View,
  ViewErrorHandler,
  ViewEventHandler,
  ViewIdHandler,
  ViewQueryHandler,
} from "../../../decorators/index.js";
import { DomainError, ViewAlreadyCreatedError } from "../../../errors/index.js";
import type {
  ViewErrorCtx,
  ViewEventCtx,
  ViewIdCtx,
  ViewQueryCtx,
} from "../../../types/index.js";
import { TestAggregate } from "../aggregates/TestAggregate.js";
import { TestCommandCreate } from "../commands/TestCommandCreate.js";
import { TestEventCreate } from "../events/TestEventCreate.js";
import { TestEventDestroy } from "../events/TestEventDestroy.js";
import { TestEventMergeState } from "../events/TestEventMergeState.js";
import { TestEventSetState } from "../events/TestEventSetState.js";
import { TestEventThrows } from "../events/TestEventThrows.js";
import { TestViewQuery } from "../queries/TestViewQuery.js";
import { TestViewEntity } from "./TestViewEntity.js";

@View(TestAggregate, TestViewEntity)
export class TestView {
  // event handlers

  @ViewEventHandler(TestEventCreate)
  @RequireNotCreated()
  public async onCreateEvent(
    ctx: ViewEventCtx<TestEventCreate, TestViewEntity>,
  ): Promise<void> {
    ctx.entity.create = ctx.event.input;
  }

  @ViewEventHandler(TestEventMergeState)
  @RequireCreated()
  public async onMergeStateEvent(
    ctx: ViewEventCtx<TestEventMergeState, TestViewEntity>,
  ): Promise<void> {
    ctx.entity.mergeState = ctx.event.input;
  }

  @ViewEventHandler(TestEventSetState)
  @RequireCreated()
  public async onSetStateEvent(
    ctx: ViewEventCtx<TestEventSetState, TestViewEntity>,
  ): Promise<void> {
    ctx.entity.setState = ctx.event.input;
  }

  @ViewEventHandler(TestEventThrows)
  @RequireCreated()
  public async onThrowsEvent(
    ctx: ViewEventCtx<TestEventThrows, TestViewEntity>,
  ): Promise<void> {
    throw new Error(ctx.event.input);
  }

  @ViewEventHandler(TestEventDestroy)
  @RequireCreated()
  public async onDestroyEvent(
    ctx: ViewEventCtx<TestEventDestroy, TestViewEntity>,
  ): Promise<void> {
    ctx.entity.destroy = ctx.event.input;
    ctx.destroy();
  }

  // id handler

  @ViewIdHandler(TestEventCreate)
  public resolveId(ctx: ViewIdCtx<TestEventCreate>): string {
    return ctx.aggregate.id;
  }

  // query handler

  @ViewQueryHandler(TestViewQuery)
  public async onQuery(
    ctx: ViewQueryCtx<TestViewQuery, TestViewEntity>,
  ): Promise<Array<TestViewEntity>> {
    return ctx.repository.find({ create: ctx.query.filter });
  }

  // error handlers

  @ViewErrorHandler(ViewAlreadyCreatedError)
  public onAlreadyCreatedError(ctx: ViewErrorCtx<TestViewEntity>): void {
    ctx.dispatch(new TestCommandCreate("already-created-retry"));
  }

  @ViewErrorHandler(DomainError)
  public onDomainError(ctx: ViewErrorCtx<TestViewEntity>): void {
    ctx.dispatch(new TestCommandCreate("retry"));
  }
}
