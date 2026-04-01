/**
 * OverdraftProtectionSaga -- monitors account balance and dispatches alerts
 *
 * Demonstrates:
 *   - @Saga(AccountAggregate) binding to an aggregate
 *   - @Namespace("banking")
 *   - ctx.dispatch() to issue commands from saga event handlers
 *   - ctx.timeout() to schedule delayed operations
 *   - ctx.mergeState() for JSONB saga state management
 *   - ctx.destroy() on terminal event (AccountClosed)
 *   - @SagaIdHandler to resolve saga identity from events
 *   - @SagaTimeoutHandler for timeout processing
 *   - @SagaErrorHandler for error recovery
 */

import {
  Saga,
  SagaEventHandler,
  SagaIdHandler,
  SagaTimeoutHandler,
  SagaErrorHandler,
  Namespace,
  RequireCreated,
  RequireNotCreated,
  DomainError,
} from "@lindorm/hermes";
import type {
  SagaEventCtx,
  SagaIdCtx,
  SagaTimeoutCtx,
  SagaErrorCtx,
} from "@lindorm/hermes";

import { AccountAggregate } from "../aggregates/AccountAggregate";
import { FlagAccount } from "../commands/FlagAccount";
import { AccountOpened } from "../events/AccountOpened";
import { FundsDeposited_V2 } from "../events/FundsDeposited_V2";
import { FundsWithdrawn } from "../events/FundsWithdrawn";
import { AccountClosed } from "../events/AccountClosed";
import { InactivityTimeout } from "../timeouts/InactivityTimeout";

export type OverdraftProtectionState = {
  ownerName: string;
  balance: number;
  lowBalanceWarning: boolean;
  lastActivityAt: string;
};

const LOW_BALANCE_THRESHOLD = 100;
const INACTIVITY_DELAY_MS = 30_000;

@Saga(AccountAggregate)
@Namespace("banking")
export class OverdraftProtectionSaga {
  @SagaEventHandler(AccountOpened)
  @RequireNotCreated()
  public async onAccountOpened(
    ctx: SagaEventCtx<AccountOpened, OverdraftProtectionState>,
  ): Promise<void> {
    ctx.mergeState({
      ownerName: ctx.event.ownerName,
      balance: ctx.event.initialBalance,
      lowBalanceWarning: ctx.event.initialBalance < LOW_BALANCE_THRESHOLD,
      lastActivityAt: new Date().toISOString(),
    });
    ctx.timeout("inactivity_check", { accountId: ctx.aggregate.id }, INACTIVITY_DELAY_MS);
  }

  @SagaEventHandler(FundsDeposited_V2)
  @RequireCreated()
  public async onFundsDeposited(
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
  public async onFundsWithdrawn(
    ctx: SagaEventCtx<FundsWithdrawn, OverdraftProtectionState>,
  ): Promise<void> {
    const newBalance = ctx.state.balance - ctx.event.amount;
    ctx.mergeState({
      balance: newBalance,
      lowBalanceWarning: newBalance < LOW_BALANCE_THRESHOLD,
      lastActivityAt: new Date().toISOString(),
    });
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
  public async onAccountClosed(
    ctx: SagaEventCtx<AccountClosed, OverdraftProtectionState>,
  ): Promise<void> {
    ctx.destroy();
  }

  @SagaIdHandler(AccountOpened)
  public resolveId(ctx: SagaIdCtx<AccountOpened>): string {
    return ctx.aggregate.id;
  }

  @SagaTimeoutHandler(InactivityTimeout)
  public async onInactivityTimeout(
    ctx: SagaTimeoutCtx<InactivityTimeout, OverdraftProtectionState>,
  ): Promise<void> {
    ctx.logger.info("Inactivity timeout fired", {
      accountId: ctx.event.accountId,
      lastActivityAt: ctx.state.lastActivityAt,
    });
    ctx.timeout(
      "inactivity_check",
      { accountId: ctx.event.accountId },
      INACTIVITY_DELAY_MS,
    );
  }

  @SagaErrorHandler(DomainError)
  public async onDomainError(ctx: SagaErrorCtx): Promise<void> {
    ctx.logger.warn("Saga domain error", { error: ctx.error.message });
  }
}
