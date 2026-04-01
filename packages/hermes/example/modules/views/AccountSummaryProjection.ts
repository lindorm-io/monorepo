/**
 * AccountSummaryProjection -- projects events into the AccountSummaryView entity
 *
 * Demonstrates:
 *   - @View(AccountAggregate, AccountSummaryView) binding aggregate to view entity
 *   - @Namespace("banking")
 *   - Direct entity mutation (ctx.entity.balance += amount) -- no mergeState
 *   - @ViewEventHandler with @RequireCreated / @RequireNotCreated
 *   - @ViewIdHandler to resolve view identity from events
 *   - @ViewQueryHandler with ctx.repository.findOne (IProteusRepository)
 *   - @ViewErrorHandler for error recovery
 *   - ctx.destroy() to mark view as destroyed
 */

import {
  View,
  ViewEventHandler,
  ViewIdHandler,
  ViewQueryHandler,
  ViewErrorHandler,
  Namespace,
  RequireCreated,
  RequireNotCreated,
  DomainError,
} from "@lindorm/hermes";
import type {
  ViewEventCtx,
  ViewIdCtx,
  ViewQueryCtx,
  ViewErrorCtx,
} from "@lindorm/hermes";

import { AccountAggregate } from "../aggregates/AccountAggregate";
import { AccountOpened } from "../events/AccountOpened";
import { FundsDeposited_V2 } from "../events/FundsDeposited_V2";
import { FundsWithdrawn } from "../events/FundsWithdrawn";
import { AccountClosed } from "../events/AccountClosed";
import { AccountFlagged } from "../events/AccountFlagged";
import { GetAccountSummary } from "../queries/GetAccountSummary";
import { AccountSummaryView } from "./AccountSummaryView";

@View(AccountAggregate, AccountSummaryView)
@Namespace("banking")
export class AccountSummaryProjection {
  @ViewEventHandler(AccountOpened)
  @RequireNotCreated()
  public async onAccountOpened(
    ctx: ViewEventCtx<AccountOpened, AccountSummaryView>,
  ): Promise<void> {
    ctx.entity.ownerName = ctx.event.ownerName;
    ctx.entity.currency = ctx.event.currency;
    ctx.entity.balance = ctx.event.initialBalance;
    ctx.entity.status = "open";
    ctx.entity.transactionCount = ctx.event.initialBalance > 0 ? 1 : 0;
  }

  @ViewEventHandler(FundsDeposited_V2)
  @RequireCreated()
  public async onFundsDeposited(
    ctx: ViewEventCtx<FundsDeposited_V2, AccountSummaryView>,
  ): Promise<void> {
    ctx.entity.balance += ctx.event.amount;
    ctx.entity.transactionCount += 1;
  }

  @ViewEventHandler(FundsWithdrawn)
  @RequireCreated()
  public async onFundsWithdrawn(
    ctx: ViewEventCtx<FundsWithdrawn, AccountSummaryView>,
  ): Promise<void> {
    ctx.entity.balance -= ctx.event.amount;
    ctx.entity.transactionCount += 1;
  }

  @ViewEventHandler(AccountFlagged)
  @RequireCreated()
  public async onAccountFlagged(
    ctx: ViewEventCtx<AccountFlagged, AccountSummaryView>,
  ): Promise<void> {
    ctx.entity.status = "flagged";
  }

  @ViewEventHandler(AccountClosed)
  @RequireCreated()
  public async onAccountClosed(
    ctx: ViewEventCtx<AccountClosed, AccountSummaryView>,
  ): Promise<void> {
    ctx.entity.status = "closed";
    ctx.destroy();
  }

  @ViewIdHandler(AccountOpened)
  public resolveId(ctx: ViewIdCtx<AccountOpened>): string {
    return ctx.aggregate.id;
  }

  @ViewQueryHandler(GetAccountSummary)
  public async onGetAccountSummary(
    ctx: ViewQueryCtx<GetAccountSummary, AccountSummaryView>,
  ): Promise<AccountSummaryView | null> {
    return ctx.repository.findOne({ id: ctx.query.accountId });
  }

  @ViewErrorHandler(DomainError)
  public onDomainError(ctx: ViewErrorCtx<AccountSummaryView>): void {
    ctx.logger.warn("View domain error", { error: ctx.error.message });
  }
}
