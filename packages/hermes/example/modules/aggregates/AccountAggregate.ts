/**
 * AccountAggregate -- the core banking domain aggregate
 *
 * Demonstrates:
 *   - @Aggregate() with @Namespace("banking")
 *   - @AggregateCommandHandler with @RequireCreated / @RequireNotCreated
 *   - @Validate(zodSchema) for command payload validation
 *   - @AggregateEventHandler with ctx.mergeState, ctx.destroy
 *   - @AggregateErrorHandler for DomainError recovery
 *   - @EventUpcaster for transparent event schema evolution (V1 -> V2)
 *   - Business logic enforcement (insufficient funds, non-zero balance close)
 */

import {
  Aggregate,
  AggregateCommandHandler,
  AggregateEventHandler,
  AggregateErrorHandler,
  EventUpcaster,
  Namespace,
  RequireCreated,
  RequireNotCreated,
  Validate,
  DomainError,
} from "@lindorm/hermes";
import type {
  AggregateCommandCtx,
  AggregateEventCtx,
  AggregateErrorCtx,
} from "@lindorm/hermes";

import { OpenAccount, OpenAccountSchema } from "../commands/OpenAccount.js";
import { DepositFunds, DepositFundsSchema } from "../commands/DepositFunds.js";
import { WithdrawFunds, WithdrawFundsSchema } from "../commands/WithdrawFunds.js";
import { CloseAccount } from "../commands/CloseAccount.js";
import { FlagAccount } from "../commands/FlagAccount.js";

import { AccountOpened } from "../events/AccountOpened.js";
import { FundsDeposited_V1 } from "../events/FundsDeposited_V1.js";
import { FundsDeposited_V2 } from "../events/FundsDeposited_V2.js";
import { FundsWithdrawn } from "../events/FundsWithdrawn.js";
import { AccountClosed } from "../events/AccountClosed.js";
import { AccountFlagged } from "../events/AccountFlagged.js";

export type AccountState = {
  ownerName: string;
  currency: string;
  balance: number;
  status: "open" | "closed" | "flagged";
  transactionCount: number;
};

@Aggregate()
@Namespace("banking")
export class AccountAggregate {
  @AggregateCommandHandler(OpenAccount)
  @RequireNotCreated()
  @Validate(OpenAccountSchema)
  public async onOpenAccount(
    ctx: AggregateCommandCtx<OpenAccount, AccountState>,
  ): Promise<void> {
    await ctx.apply(
      new AccountOpened(
        ctx.command.ownerName,
        ctx.command.currency,
        ctx.command.initialDeposit,
      ),
    );
  }

  @AggregateCommandHandler(DepositFunds)
  @RequireCreated()
  @Validate(DepositFundsSchema)
  public async onDepositFunds(
    ctx: AggregateCommandCtx<DepositFunds, AccountState>,
  ): Promise<void> {
    await ctx.apply(new FundsDeposited_V2(ctx.command.amount, ctx.command.currency));
  }

  @AggregateCommandHandler(WithdrawFunds)
  @RequireCreated()
  @Validate(WithdrawFundsSchema)
  public async onWithdrawFunds(
    ctx: AggregateCommandCtx<WithdrawFunds, AccountState>,
  ): Promise<void> {
    if (ctx.state.balance < ctx.command.amount) {
      throw new DomainError("Insufficient funds", {
        data: { balance: ctx.state.balance, requested: ctx.command.amount },
      });
    }
    await ctx.apply(new FundsWithdrawn(ctx.command.amount));
  }

  @AggregateCommandHandler(FlagAccount)
  @RequireCreated()
  public async onFlagAccount(
    ctx: AggregateCommandCtx<FlagAccount, AccountState>,
  ): Promise<void> {
    await ctx.apply(new AccountFlagged(ctx.command.reason));
  }

  @AggregateCommandHandler(CloseAccount)
  @RequireCreated()
  public async onCloseAccount(
    ctx: AggregateCommandCtx<CloseAccount, AccountState>,
  ): Promise<void> {
    if (ctx.state.balance !== 0) {
      throw new DomainError("Cannot close account with non-zero balance", {
        data: { balance: ctx.state.balance },
      });
    }
    await ctx.apply(new AccountClosed());
  }

  @AggregateEventHandler(AccountOpened)
  public async onAccountOpened(
    ctx: AggregateEventCtx<AccountOpened, AccountState>,
  ): Promise<void> {
    ctx.mergeState({
      ownerName: ctx.event.ownerName,
      currency: ctx.event.currency,
      balance: ctx.event.initialBalance,
      status: "open",
      transactionCount: ctx.event.initialBalance > 0 ? 1 : 0,
    });
  }

  @AggregateEventHandler(FundsDeposited_V2)
  public async onFundsDeposited(
    ctx: AggregateEventCtx<FundsDeposited_V2, AccountState>,
  ): Promise<void> {
    ctx.mergeState({
      balance: ctx.state.balance + ctx.event.amount,
      transactionCount: ctx.state.transactionCount + 1,
    });
  }

  @AggregateEventHandler(FundsWithdrawn)
  public async onFundsWithdrawn(
    ctx: AggregateEventCtx<FundsWithdrawn, AccountState>,
  ): Promise<void> {
    ctx.mergeState({
      balance: ctx.state.balance - ctx.event.amount,
      transactionCount: ctx.state.transactionCount + 1,
    });
  }

  @AggregateEventHandler(AccountFlagged)
  public async onAccountFlagged(
    ctx: AggregateEventCtx<AccountFlagged, AccountState>,
  ): Promise<void> {
    ctx.mergeState({ status: "flagged" });
  }

  @AggregateEventHandler(AccountClosed)
  public async onAccountClosed(
    ctx: AggregateEventCtx<AccountClosed, AccountState>,
  ): Promise<void> {
    ctx.mergeState({ status: "closed" });
    ctx.destroy();
  }

  // -- Upcaster: FundsDeposited V1 -> V2 --
  //
  // Legacy V1 events stored before the currency field was added are
  // transparently upcasted to V2 at aggregate load time. The original
  // V1 record in the event store is never modified.

  @EventUpcaster(FundsDeposited_V1, FundsDeposited_V2)
  public upcastFundsDepositedV1toV2(event: FundsDeposited_V1): FundsDeposited_V2 {
    return new FundsDeposited_V2(event.amount, "USD");
  }

  @AggregateErrorHandler(DomainError)
  public async onDomainError(ctx: AggregateErrorCtx): Promise<void> {
    ctx.logger.warn("Aggregate domain error", { error: ctx.error.message });
  }
}
