import type { Dict } from "@lindorm/types";
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
} from "../../../decorators";
import { DomainError } from "../../../errors";
import type {
  AggregateCommandCtx,
  AggregateEventCtx,
  AggregateErrorCtx,
} from "../../../types";

import { OpenAccount, OpenAccountSchema } from "../commands/OpenAccount";
import { DepositFunds, DepositFundsSchema } from "../commands/DepositFunds";
import { WithdrawFunds, WithdrawFundsSchema } from "../commands/WithdrawFunds";
import { CloseAccount } from "../commands/CloseAccount";
import { FlagAccount } from "../commands/FlagAccount";

import { AccountOpened } from "../events/AccountOpened";
import { FundsDeposited_V1 } from "../events/FundsDeposited_V1";
import { FundsDeposited_V2 } from "../events/FundsDeposited_V2";
import { FundsWithdrawn } from "../events/FundsWithdrawn";
import { AccountClosed } from "../events/AccountClosed";
import { AccountFlagged } from "../events/AccountFlagged";

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
  // -- Command Handlers --

  @AggregateCommandHandler(OpenAccount)
  @RequireNotCreated()
  @Validate(OpenAccountSchema)
  async onOpenAccount(
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
  async onDepositFunds(
    ctx: AggregateCommandCtx<DepositFunds, AccountState>,
  ): Promise<void> {
    await ctx.apply(new FundsDeposited_V2(ctx.command.amount, ctx.command.currency));
  }

  @AggregateCommandHandler(WithdrawFunds)
  @RequireCreated()
  @Validate(WithdrawFundsSchema)
  async onWithdrawFunds(
    ctx: AggregateCommandCtx<WithdrawFunds, AccountState>,
  ): Promise<void> {
    if (ctx.state.balance < ctx.command.amount) {
      throw new DomainError("Insufficient funds", {
        data: {
          balance: ctx.state.balance,
          requested: ctx.command.amount,
        },
      });
    }
    await ctx.apply(new FundsWithdrawn(ctx.command.amount));
  }

  @AggregateCommandHandler(FlagAccount)
  @RequireCreated()
  async onFlagAccount(
    ctx: AggregateCommandCtx<FlagAccount, AccountState>,
  ): Promise<void> {
    await ctx.apply(new AccountFlagged(ctx.command.reason));
  }

  @AggregateCommandHandler(CloseAccount)
  @RequireCreated()
  async onCloseAccount(
    ctx: AggregateCommandCtx<CloseAccount, AccountState>,
  ): Promise<void> {
    if (ctx.state.balance !== 0) {
      throw new DomainError("Cannot close account with non-zero balance", {
        data: { balance: ctx.state.balance },
      });
    }
    await ctx.apply(new AccountClosed());
  }

  // -- Event Handlers --

  @AggregateEventHandler(AccountOpened)
  async onAccountOpened(
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
  async onFundsDeposited(
    ctx: AggregateEventCtx<FundsDeposited_V2, AccountState>,
  ): Promise<void> {
    ctx.mergeState({
      balance: ctx.state.balance + ctx.event.amount,
      transactionCount: ctx.state.transactionCount + 1,
    });
  }

  @AggregateEventHandler(FundsWithdrawn)
  async onFundsWithdrawn(
    ctx: AggregateEventCtx<FundsWithdrawn, AccountState>,
  ): Promise<void> {
    ctx.mergeState({
      balance: ctx.state.balance - ctx.event.amount,
      transactionCount: ctx.state.transactionCount + 1,
    });
  }

  @AggregateEventHandler(AccountFlagged)
  async onAccountFlagged(
    ctx: AggregateEventCtx<AccountFlagged, AccountState>,
  ): Promise<void> {
    ctx.mergeState({ status: "flagged" });
  }

  @AggregateEventHandler(AccountClosed)
  async onAccountClosed(
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
  upcastFundsDepositedV1toV2(event: FundsDeposited_V1): FundsDeposited_V2 {
    return new FundsDeposited_V2(event.amount, "USD");
  }

  // -- Error Handler --

  @AggregateErrorHandler(DomainError)
  async onDomainError(ctx: AggregateErrorCtx): Promise<void> {
    ctx.logger.warn("Aggregate domain error", { error: ctx.error.message });
  }
}
