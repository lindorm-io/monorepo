import type { Dict } from "@lindorm/types";
import {
  Saga,
  SagaEventHandler,
  SagaIdHandler,
  SagaTimeoutHandler,
  SagaErrorHandler,
  Namespace,
  RequireCreated,
  RequireNotCreated,
} from "../../../decorators/index.js";
import { DomainError } from "../../../errors/index.js";
import type {
  SagaEventCtx,
  SagaIdCtx,
  SagaTimeoutCtx,
  SagaErrorCtx,
} from "../../../types/index.js";

import { AccountAggregate } from "../aggregates/AccountAggregate.js";
import { FlagAccount } from "../commands/FlagAccount.js";

import { AccountOpened } from "../events/AccountOpened.js";
import { FundsDeposited_V2 } from "../events/FundsDeposited_V2.js";
import { FundsWithdrawn } from "../events/FundsWithdrawn.js";
import { AccountClosed } from "../events/AccountClosed.js";

import { InactivityTimeout } from "../timeouts/InactivityTimeout.js";

export type OverdraftProtectionState = {
  ownerName: string;
  balance: number;
  lowBalanceWarning: boolean;
  lastActivityAt: string;
};

const LOW_BALANCE_THRESHOLD = 100;
const INACTIVITY_DELAY_MS = 30_000; // 30 seconds for demo purposes

@Saga(AccountAggregate)
@Namespace("banking")
export class OverdraftProtectionSaga {
  // -- Event Handlers --

  @SagaEventHandler(AccountOpened)
  @RequireNotCreated()
  async onAccountOpened(
    ctx: SagaEventCtx<AccountOpened, OverdraftProtectionState>,
  ): Promise<void> {
    ctx.mergeState({
      ownerName: ctx.event.ownerName,
      balance: ctx.event.initialBalance,
      lowBalanceWarning: ctx.event.initialBalance < LOW_BALANCE_THRESHOLD,
      lastActivityAt: new Date().toISOString(),
    });

    // Schedule an inactivity check
    ctx.timeout("inactivity_check", { accountId: ctx.aggregate.id }, INACTIVITY_DELAY_MS);
  }

  @SagaEventHandler(FundsDeposited_V2)
  @RequireCreated()
  async onFundsDeposited(
    ctx: SagaEventCtx<FundsDeposited_V2, OverdraftProtectionState>,
  ): Promise<void> {
    const newBalance = ctx.state.balance + ctx.event.amount;

    ctx.mergeState({
      balance: newBalance,
      lowBalanceWarning: newBalance < LOW_BALANCE_THRESHOLD,
      lastActivityAt: new Date().toISOString(),
    });
  }

  @SagaEventHandler(FundsWithdrawn)
  @RequireCreated()
  async onFundsWithdrawn(
    ctx: SagaEventCtx<FundsWithdrawn, OverdraftProtectionState>,
  ): Promise<void> {
    const newBalance = ctx.state.balance - ctx.event.amount;

    ctx.mergeState({
      balance: newBalance,
      lowBalanceWarning: newBalance < LOW_BALANCE_THRESHOLD,
      lastActivityAt: new Date().toISOString(),
    });

    // If balance drops below threshold, dispatch a FlagAccount command
    if (newBalance < LOW_BALANCE_THRESHOLD) {
      ctx.dispatch(
        new FlagAccount(
          `Balance dropped below ${LOW_BALANCE_THRESHOLD}: current balance is ${newBalance}`,
        ),
        { id: ctx.aggregate.id },
      );
    }
  }

  @SagaEventHandler(AccountClosed)
  @RequireCreated()
  async onAccountClosed(
    ctx: SagaEventCtx<AccountClosed, OverdraftProtectionState>,
  ): Promise<void> {
    ctx.destroy();
  }

  // -- ID Handler --

  @SagaIdHandler(AccountOpened)
  resolveId(ctx: SagaIdCtx<AccountOpened>): string {
    return ctx.aggregate.id;
  }

  // -- Timeout Handler --

  @SagaTimeoutHandler(InactivityTimeout)
  async onInactivityTimeout(
    ctx: SagaTimeoutCtx<InactivityTimeout, OverdraftProtectionState>,
  ): Promise<void> {
    ctx.logger.info("Inactivity timeout fired", {
      accountId: ctx.event.accountId,
      lastActivityAt: ctx.state.lastActivityAt,
    });

    // Reschedule for continuous monitoring
    ctx.timeout(
      "inactivity_check",
      { accountId: ctx.event.accountId },
      INACTIVITY_DELAY_MS,
    );
  }

  // -- Error Handler --

  @SagaErrorHandler(DomainError)
  async onDomainError(ctx: SagaErrorCtx): Promise<void> {
    ctx.logger.warn("Saga domain error", { error: ctx.error.message });
  }
}
