import {
  View,
  ViewEventHandler,
  ViewIdHandler,
  ViewQueryHandler,
  ViewErrorHandler,
  Namespace,
  RequireCreated,
  RequireNotCreated,
} from "../../../decorators/index.js";
import { DomainError } from "../../../errors/index.js";
import type {
  ViewEventCtx,
  ViewIdCtx,
  ViewQueryCtx,
  ViewErrorCtx,
} from "../../../types/index.js";

import { AccountAggregate } from "../aggregates/AccountAggregate.js";

import { AccountOpened } from "../events/AccountOpened.js";
import { FundsDeposited_V2 } from "../events/FundsDeposited_V2.js";
import { FundsWithdrawn } from "../events/FundsWithdrawn.js";
import { AccountClosed } from "../events/AccountClosed.js";
import { AccountFlagged } from "../events/AccountFlagged.js";

import { GetAccountSummary } from "../queries/GetAccountSummary.js";
import { AccountSummaryView } from "./AccountSummaryView.js";

@View(AccountAggregate, AccountSummaryView)
@Namespace("banking")
export class AccountSummaryProjection {
  // -- Event Handlers (direct entity mutation -- no mergeState needed) --

  @ViewEventHandler(AccountOpened)
  @RequireNotCreated()
  async onAccountOpened(
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
  async onFundsDeposited(
    ctx: ViewEventCtx<FundsDeposited_V2, AccountSummaryView>,
  ): Promise<void> {
    ctx.entity.balance += ctx.event.amount;
    ctx.entity.transactionCount += 1;
  }

  @ViewEventHandler(FundsWithdrawn)
  @RequireCreated()
  async onFundsWithdrawn(
    ctx: ViewEventCtx<FundsWithdrawn, AccountSummaryView>,
  ): Promise<void> {
    ctx.entity.balance -= ctx.event.amount;
    ctx.entity.transactionCount += 1;
  }

  @ViewEventHandler(AccountFlagged)
  @RequireCreated()
  async onAccountFlagged(
    ctx: ViewEventCtx<AccountFlagged, AccountSummaryView>,
  ): Promise<void> {
    ctx.entity.status = "flagged";
  }

  @ViewEventHandler(AccountClosed)
  @RequireCreated()
  async onAccountClosed(
    ctx: ViewEventCtx<AccountClosed, AccountSummaryView>,
  ): Promise<void> {
    ctx.entity.status = "closed";
    ctx.destroy();
  }

  // -- ID Handler --

  @ViewIdHandler(AccountOpened)
  resolveId(ctx: ViewIdCtx<AccountOpened>): string {
    return ctx.aggregate.id;
  }

  // -- Query Handler (uses IProteusRepository) --

  @ViewQueryHandler(GetAccountSummary)
  async onGetAccountSummary(
    ctx: ViewQueryCtx<GetAccountSummary, AccountSummaryView>,
  ): Promise<AccountSummaryView | null> {
    return ctx.repository.findOne({ id: ctx.query.accountId });
  }

  // -- Error Handler --

  @ViewErrorHandler(DomainError)
  onDomainError(ctx: ViewErrorCtx<AccountSummaryView>): void {
    ctx.logger.warn("View domain error", { error: ctx.error.message });
  }
}
