import {
  RequireCreated,
  RequireNotCreated,
  View,
  ViewErrorHandler,
  ViewEventHandler,
  ViewIdHandler,
  ViewQueryHandler,
} from "../../../decorators";
import { DomainError, ViewAlreadyCreatedError } from "../../../errors";
import type { ViewErrorCtx, ViewEventCtx, ViewIdCtx, ViewQueryCtx } from "../../../types";
import { TestAggregate } from "../aggregates/TestAggregate";
import { TestCommandCreate } from "../commands/TestCommandCreate";
import { TestEventCreate } from "../events/TestEventCreate";
import { TestEventDestroy } from "../events/TestEventDestroy";
import { TestEventMergeState } from "../events/TestEventMergeState";
import { TestEventSetState } from "../events/TestEventSetState";
import { TestEventThrows } from "../events/TestEventThrows";
import { TestViewQuery } from "../queries/TestViewQuery";
import { TestViewEntity } from "./TestViewEntity";

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
