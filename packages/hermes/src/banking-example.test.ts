/**
 * Hermes v2 Banking Example — Public API
 *
 * This is a comprehensive, runnable example that demonstrates ALL major Hermes v2
 * features using memory drivers (no Docker needed). Unlike unit tests that wire up
 * internal domains, this test uses only the public Hermes API — the same code a
 * real user would write.
 *
 * Features demonstrated:
 *   1. CQRS flow: hermes.command() -> aggregate -> events -> views
 *   2. Typed view entities with Proteus decorators (@Entity, @Field, @Index, @Default)
 *   3. Direct entity mutation in view handlers (ctx.entity.balance += amount)
 *   4. View queries via hermes.query()
 *   5. Sagas with dispatch (command dispatch) and timeout scheduling
 *   6. Composable decorators (@RequireCreated, @RequireNotCreated, @Validate, @Namespace)
 *   7. Event upcasting (@EventUpcaster for transparent schema evolution)
 *   8. Event emitter (hermes.on("view", ...), hermes.on("saga", ...))
 *   9. Admin inspect (aggregate, saga, view)
 *  10. Memory drivers (everything in-process, synchronous pipeline)
 *
 * Run:  cd packages/hermes && npm test -- "banking-example"
 *
 * The module definitions in __fixtures__/example/ show the code a real user would write:
 *   - commands/   -- DTO classes with @Command() and @Validate() schemas
 *   - events/     -- DTO classes with @Event()
 *   - aggregates/ -- @Aggregate with @AggregateCommandHandler, @AggregateEventHandler
 *   - sagas/      -- @Saga with dispatch(), timeout(), @SagaEventHandler
 *   - views/      -- @View projection + Proteus entity (extends HermesViewEntity)
 *   - timeouts/   -- @Timeout DTO
 *   - queries/    -- @Query DTO
 */

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ProteusSource } from "@lindorm/proteus";
import type { IrisSource } from "@lindorm/iris";
import { randomUUID } from "crypto";

import { Hermes } from "./classes/Hermes.js";
import {
  createTestIrisSource,
  createTestProteusSource,
} from "./__fixtures__/create-test-sources.js";
import { EventRecord } from "./internal/entities/index.js";

// -- Example module imports (same as what a user would write) --
import { OpenAccount } from "./__fixtures__/example/commands/OpenAccount.js";
import { DepositFunds } from "./__fixtures__/example/commands/DepositFunds.js";
import { WithdrawFunds } from "./__fixtures__/example/commands/WithdrawFunds.js";
import { CloseAccount } from "./__fixtures__/example/commands/CloseAccount.js";
import { FlagAccount } from "./__fixtures__/example/commands/FlagAccount.js";

import { AccountOpened } from "./__fixtures__/example/events/AccountOpened.js";
import { FundsDeposited_V1 } from "./__fixtures__/example/events/FundsDeposited_V1.js";
import { FundsDeposited_V2 } from "./__fixtures__/example/events/FundsDeposited_V2.js";
import { FundsWithdrawn } from "./__fixtures__/example/events/FundsWithdrawn.js";
import { AccountClosed } from "./__fixtures__/example/events/AccountClosed.js";
import { AccountFlagged } from "./__fixtures__/example/events/AccountFlagged.js";

import { InactivityTimeout } from "./__fixtures__/example/timeouts/InactivityTimeout.js";
import { GetAccountSummary } from "./__fixtures__/example/queries/GetAccountSummary.js";
import { AccountAggregate } from "./__fixtures__/example/aggregates/AccountAggregate.js";
import { OverdraftProtectionSaga } from "./__fixtures__/example/sagas/OverdraftProtectionSaga.js";
import { AccountSummaryView } from "./__fixtures__/example/views/AccountSummaryView.js";
import { AccountSummaryProjection } from "./__fixtures__/example/views/AccountSummaryProjection.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ============================================================================
// All module constructors (what you'd pass to Hermes in production)
// ============================================================================

const ALL_MODULES = [
  OpenAccount,
  DepositFunds,
  WithdrawFunds,
  CloseAccount,
  FlagAccount,
  AccountOpened,
  FundsDeposited_V1,
  FundsDeposited_V2,
  FundsWithdrawn,
  AccountClosed,
  AccountFlagged,
  InactivityTimeout,
  GetAccountSummary,
  AccountAggregate,
  OverdraftProtectionSaga,
  AccountSummaryProjection,
];

// ============================================================================
// Test
// ============================================================================

describe("Banking Example", () => {
  const logger = createMockLogger();

  let hermes: Hermes;
  let proteus: ProteusSource;
  let iris: IrisSource;

  beforeAll(async () => {
    proteus = createTestProteusSource();
    iris = createTestIrisSource();

    await proteus.connect();
    await iris.connect();

    hermes = new Hermes({
      proteus,
      iris,
      modules: ALL_MODULES,
      logger,
      namespace: "banking",
    });

    await hermes.setup();
  });

  afterAll(async () => {
    await hermes.teardown();
    await iris.disconnect();
    await proteus.disconnect();
  });

  // --------------------------------------------------------------------------
  // Feature 1: Basic CQRS — command -> aggregate -> events -> view
  // --------------------------------------------------------------------------

  describe("Feature 1: Basic CQRS flow", () => {
    it("should open an account and project to the view", async () => {
      const { id } = await hermes.command(new OpenAccount("Alice Johnson", "USD", 500));

      // Verify aggregate state
      const aggregate = await hermes.admin.inspect.aggregate({
        id,
        name: "account_aggregate",
      });

      expect(aggregate.state).toEqual({
        ownerName: "Alice Johnson",
        currency: "USD",
        balance: 500,
        status: "open",
        transactionCount: 1,
      });
      expect(aggregate.numberOfLoadedEvents).toBe(1);
      expect(aggregate.destroyed).toBe(false);

      // Verify view entity (Feature 2: typed entity with @Field, @Index, @Default)
      const view = await hermes.admin.inspect.view({
        id,
        entity: AccountSummaryView,
      });

      expect(view).not.toBeNull();
      expect(view!.ownerName).toBe("Alice Johnson");
      expect(view!.currency).toBe("USD");
      expect(view!.balance).toBe(500);
      expect(view!.status).toBe("open");
      expect(view!.transactionCount).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: Direct entity mutation (ctx.entity.balance += amount)
  // --------------------------------------------------------------------------

  describe("Feature 3: Direct entity mutation in views", () => {
    it("should deposit and withdraw funds with direct entity mutation", async () => {
      const { id } = await hermes.command(new OpenAccount("Bob Smith", "EUR", 500));

      // Three deposits
      await hermes.command(new DepositFunds(200, "EUR"), { id });
      await hermes.command(new DepositFunds(150, "EUR"), { id });
      await hermes.command(new DepositFunds(50, "EUR"), { id });

      const afterDeposits = await hermes.admin.inspect.view({
        id,
        entity: AccountSummaryView,
      });

      expect(afterDeposits).not.toBeNull();
      expect(afterDeposits!.balance).toBe(900); // 500 + 200 + 150 + 50
      expect(afterDeposits!.transactionCount).toBe(4); // 1 initial + 3 deposits

      // Withdraw $800
      await hermes.command(new WithdrawFunds(800), { id });

      const afterWithdraw = await hermes.admin.inspect.view({
        id,
        entity: AccountSummaryView,
      });

      expect(afterWithdraw!.balance).toBe(100); // 900 - 800
      expect(afterWithdraw!.transactionCount).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: View queries with hermes.query()
  // --------------------------------------------------------------------------

  describe("Feature 4: View queries", () => {
    it("should query account summary by ID", async () => {
      const { id } = await hermes.command(new OpenAccount("Carol Davis", "GBP", 1000));

      const result = await hermes.query<AccountSummaryView | null>(
        new GetAccountSummary(id),
      );

      expect(result).not.toBeNull();
      expect(result!.id).toBe(id);
      expect(result!.ownerName).toBe("Carol Davis");
      expect(result!.currency).toBe("GBP");
      expect(result!.balance).toBe(1000);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Saga with dispatch -- overdraft protection
  // --------------------------------------------------------------------------

  describe("Feature 5: Saga with dispatch", () => {
    it("should track balance and dispatch FlagAccount when below threshold", async () => {
      const { id } = await hermes.command(new OpenAccount("Dave Wilson", "USD", 200));

      // Verify saga was created
      const saga = await hermes.admin.inspect.saga({
        id,
        name: "overdraft_protection_saga",
      });

      expect(saga).not.toBeNull();
      expect(saga!.state).toEqual(
        expect.objectContaining({
          ownerName: "Dave Wilson",
          balance: 200,
          lowBalanceWarning: false,
        }),
      );

      // Withdraw $150 (drops below $100 threshold)
      await hermes.command(new WithdrawFunds(150), { id });

      // Verify saga state reflects low balance
      const updatedSaga = await hermes.admin.inspect.saga({
        id,
        name: "overdraft_protection_saga",
      });

      expect(updatedSaga!.state).toEqual(
        expect.objectContaining({
          balance: 50,
          lowBalanceWarning: true,
        }),
      );

      // The saga dispatches a FlagAccount command, which runs through the
      // aggregate pipeline. Verify the aggregate reflects the flagged status.
      const aggregate = await hermes.admin.inspect.aggregate({
        id,
        name: "account_aggregate",
      });

      expect(aggregate.state).toEqual(expect.objectContaining({ status: "flagged" }));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 6: Composable decorators
  // --------------------------------------------------------------------------

  describe("Feature 6: Composable decorators", () => {
    it("@RequireNotCreated prevents duplicate account creation", async () => {
      const { id } = await hermes.command(new OpenAccount("Frank Green", "USD", 100));

      // Second open on the same aggregate is silently rejected by the
      // command handler (@RequireNotCreated). hermes.command() is fire-and-forget
      // so it does not throw -- errors are routed to the error queue.
      // Verify the aggregate still has only 1 event (the original open).
      await hermes.command(new OpenAccount("Frank Green", "USD", 100), { id });

      const aggregate = await hermes.admin.inspect.aggregate({
        id,
        name: "account_aggregate",
      });

      expect(aggregate.numberOfLoadedEvents).toBe(1);
    });

    it("@RequireCreated prevents operations on non-existent accounts", async () => {
      const id = randomUUID();

      // Deposit on a non-existent aggregate is silently rejected.
      // Verify aggregate has no events.
      await hermes.command(new DepositFunds(100, "USD"), { id });

      const aggregate = await hermes.admin.inspect.aggregate({
        id,
        name: "account_aggregate",
      });

      expect(aggregate.numberOfLoadedEvents).toBe(0);
    });

    it("@Validate rejects invalid command data (negative deposit)", async () => {
      const { id } = await hermes.command(new OpenAccount("Grace Lee", "USD", 100));

      // Invalid deposit is silently rejected by schema validation.
      // Verify the aggregate balance hasn't changed.
      await hermes.command(new DepositFunds(-50, "USD"), { id });

      const aggregate = await hermes.admin.inspect.aggregate({
        id,
        name: "account_aggregate",
      });

      expect(aggregate.numberOfLoadedEvents).toBe(1);
      expect(aggregate.state).toEqual(expect.objectContaining({ balance: 100 }));
    });

    it("@Namespace assigns 'banking' namespace to aggregate", async () => {
      const { id } = await hermes.command(new OpenAccount("Namespace User", "USD", 100));

      const aggregate = await hermes.admin.inspect.aggregate({
        id,
        name: "account_aggregate",
      });

      expect(aggregate.namespace).toBe("banking");
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Event emitter
  // --------------------------------------------------------------------------

  describe("Feature 7: Event emitter", () => {
    it("should emit view events via hermes.on('view', ...)", async () => {
      const viewEvents: Array<unknown> = [];
      const listener = (data: unknown) => viewEvents.push(data);
      hermes.on("view", listener);

      const { id } = await hermes.command(new OpenAccount("Henry Kim", "USD", 750));

      expect(viewEvents.length).toBeGreaterThan(0);
      expect(viewEvents[viewEvents.length - 1]).toEqual(
        expect.objectContaining({
          id,
          name: "account_summary",
          namespace: "banking",
          destroyed: false,
        }),
      );

      hermes.off("view", listener);
    });

    it("should emit saga events via hermes.on('saga', ...)", async () => {
      const sagaEvents: Array<unknown> = [];
      const listener = (data: unknown) => sagaEvents.push(data);
      hermes.on("saga", listener);

      const { id } = await hermes.command(new OpenAccount("Iris Park", "USD", 250));

      expect(sagaEvents.length).toBeGreaterThan(0);
      expect(sagaEvents[sagaEvents.length - 1]).toEqual(
        expect.objectContaining({
          id,
          name: "overdraft_protection_saga",
          namespace: "banking",
        }),
      );

      hermes.off("saga", listener);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 8: Admin inspect
  // --------------------------------------------------------------------------

  describe("Feature 8: Admin inspect", () => {
    it("should inspect aggregate state with full event history", async () => {
      const { id } = await hermes.command(new OpenAccount("Jack Chen", "USD", 500));

      await hermes.command(new DepositFunds(200, "USD"), { id });
      await hermes.command(new WithdrawFunds(100), { id });

      const aggregate = await hermes.admin.inspect.aggregate({
        id,
        name: "account_aggregate",
      });

      expect(aggregate.id).toBe(id);
      expect(aggregate.name).toBe("account_aggregate");
      expect(aggregate.namespace).toBe("banking");
      expect(aggregate.destroyed).toBe(false);
      expect(aggregate.numberOfLoadedEvents).toBe(3);
      expect(aggregate.state).toEqual({
        ownerName: "Jack Chen",
        currency: "USD",
        balance: 600, // 500 + 200 - 100
        status: "open",
        transactionCount: 3,
      });
    });

    it("should inspect saga state", async () => {
      const { id } = await hermes.command(new OpenAccount("Kate Liu", "USD", 300));

      const saga = await hermes.admin.inspect.saga({
        id,
        name: "overdraft_protection_saga",
      });

      expect(saga).not.toBeNull();
      expect(saga!.id).toBe(id);
      expect(saga!.name).toBe("overdraft_protection_saga");
      expect(saga!.namespace).toBe("banking");
      expect(saga!.destroyed).toBe(false);
      expect(saga!.state).toEqual(
        expect.objectContaining({
          ownerName: "Kate Liu",
          balance: 300,
          lowBalanceWarning: false,
        }),
      );
    });

    it("should inspect view entity", async () => {
      const { id } = await hermes.command(new OpenAccount("Leo Wang", "JPY", 10000));

      const view = await hermes.admin.inspect.view({
        id,
        entity: AccountSummaryView,
      });

      expect(view).not.toBeNull();
      expect(view!.id).toBe(id);
      expect(view!.ownerName).toBe("Leo Wang");
      expect(view!.currency).toBe("JPY");
      expect(view!.balance).toBe(10000);
      expect(view!.status).toBe("open");
      expect(view!.transactionCount).toBe(1);
      expect(view!.destroyed).toBe(false);
      expect(view!.revision).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Account closure (destroy aggregate + view + saga)
  // --------------------------------------------------------------------------

  describe("Account closure", () => {
    it("should close account and mark aggregate + view + saga as destroyed", async () => {
      // Open with zero balance so we can close immediately
      const { id } = await hermes.command(new OpenAccount("Mia Zhang", "USD", 0));

      await hermes.command(new CloseAccount(), { id });

      // Aggregate should be destroyed
      const aggregate = await hermes.admin.inspect.aggregate({
        id,
        name: "account_aggregate",
      });

      expect(aggregate.destroyed).toBe(true);
      expect(aggregate.state).toEqual(expect.objectContaining({ status: "closed" }));

      // View should be destroyed
      const view = await hermes.admin.inspect.view({
        id,
        entity: AccountSummaryView,
      });

      expect(view!.destroyed).toBe(true);
      expect(view!.status).toBe("closed");

      // Saga should be destroyed
      const saga = await hermes.admin.inspect.saga({
        id,
        name: "overdraft_protection_saga",
      });

      expect(saga!.destroyed).toBe(true);
    });

    it("should reject close on account with non-zero balance", async () => {
      const { id } = await hermes.command(new OpenAccount("Noah Lee", "USD", 500));

      // Close is silently rejected by the domain error (non-zero balance).
      // Verify the aggregate is NOT destroyed.
      await hermes.command(new CloseAccount(), { id });

      const aggregate = await hermes.admin.inspect.aggregate({
        id,
        name: "account_aggregate",
      });

      expect(aggregate.destroyed).toBe(false);
      expect(aggregate.state).toEqual(
        expect.objectContaining({ status: "open", balance: 500 }),
      );
    });
  });

  // --------------------------------------------------------------------------
  // Domain error handling (DomainError)
  // --------------------------------------------------------------------------

  describe("Domain error handling", () => {
    it("should reject withdrawal exceeding balance (aggregate state unchanged)", async () => {
      const { id } = await hermes.command(new OpenAccount("Olivia Brown", "USD", 100));

      // Withdrawal exceeding balance is silently rejected by the domain error.
      // hermes.command() is fire-and-forget; the error goes to the error queue.
      // Verify the aggregate balance is unchanged.
      await hermes.command(new WithdrawFunds(200), { id });

      const aggregate = await hermes.admin.inspect.aggregate({
        id,
        name: "account_aggregate",
      });

      expect(aggregate.numberOfLoadedEvents).toBe(1);
      expect(aggregate.state).toEqual(expect.objectContaining({ balance: 100 }));
    });
  });

  // --------------------------------------------------------------------------
  // Event record integrity
  // --------------------------------------------------------------------------

  describe("Event record integrity", () => {
    it("should maintain previousId chain and incrementing expectedEvents", async () => {
      const { id } = await hermes.command(new OpenAccount("Peter Jones", "USD", 500));

      await hermes.command(new DepositFunds(200, "USD"), { id });
      await hermes.command(new WithdrawFunds(100), { id });

      const eventRepo = proteus.repository(EventRecord);
      const events = await eventRepo.find(
        {
          aggregateId: id,
          aggregateName: "account_aggregate",
          aggregateNamespace: "banking",
        },
        { order: { expectedEvents: "ASC" } },
      );

      expect(events).toHaveLength(3);
      expect(events[0].name).toBe("account_opened");
      expect(events[0].expectedEvents).toBe(0);
      expect(events[0].previousId).toBeNull();
      expect(events[1].name).toBe("funds_deposited");
      expect(events[1].expectedEvents).toBe(1);
      expect(events[1].previousId).toBe(events[0].id);
      expect(events[2].name).toBe("funds_withdrawn");
      expect(events[2].expectedEvents).toBe(2);
      expect(events[2].previousId).toBe(events[1].id);
    });

    it("should store checksums on all events", async () => {
      const { id } = await hermes.command(new OpenAccount("Quinn Taylor", "USD", 100));

      const eventRepo = proteus.repository(EventRecord);
      const events = await eventRepo.find({ aggregateId: id });

      expect(events).toHaveLength(1);
      expect(events[0].checksum).toBeTruthy();
      expect(typeof events[0].checksum).toBe("string");
      expect(events[0].checksum.length).toBeGreaterThan(10);
    });
  });

  // --------------------------------------------------------------------------
  // Event upcasting (FundsDeposited V1 -> V2)
  // --------------------------------------------------------------------------

  describe("Event upcasting", () => {
    it("should upcast a legacy V1 FundsDeposited event when loading the aggregate", async () => {
      // Step 1: Open the account normally (produces an AccountOpened V1 event)
      const { id } = await hermes.command(new OpenAccount("Legacy User", "USD", 0));

      // Step 2: Manually seed a V1 FundsDeposited event into the event store.
      // This simulates a legacy event that was stored before the currency field
      // was added to FundsDeposited.
      const eventRepo = proteus.repository(EventRecord);

      const existingEvents = await eventRepo.find(
        {
          aggregateId: id,
          aggregateName: "account_aggregate",
          aggregateNamespace: "banking",
        },
        { order: { expectedEvents: "ASC" } },
      );

      const lastEvent = existingEvents[existingEvents.length - 1];

      const legacyRecord = new EventRecord();
      legacyRecord.id = randomUUID();
      legacyRecord.aggregateId = id;
      legacyRecord.aggregateName = "account_aggregate";
      legacyRecord.aggregateNamespace = "banking";
      legacyRecord.causationId = randomUUID();
      legacyRecord.correlationId = "";
      legacyRecord.data = { amount: 250 }; // V1 schema: no currency field
      legacyRecord.encrypted = false;
      legacyRecord.name = "funds_deposited";
      legacyRecord.version = 1; // V1
      legacyRecord.timestamp = new Date();
      legacyRecord.expectedEvents = existingEvents.length;
      legacyRecord.meta = {};
      legacyRecord.previousId = lastEvent.id;
      legacyRecord.checksum = "";

      await eventRepo.insert([legacyRecord]);

      // Step 3: Load the aggregate via admin inspect -- this triggers the upcaster chain.
      // The V1 event should be transparently upcasted to V2 with currency: "USD".
      const aggregate = await hermes.admin.inspect.aggregate({
        id,
        name: "account_aggregate",
      });

      expect(aggregate.numberOfLoadedEvents).toBe(2);
      expect(aggregate.state).toEqual({
        ownerName: "Legacy User",
        currency: "USD",
        balance: 250, // V1 amount was upcasted and applied
        status: "open",
        transactionCount: 1, // only the deposit counts (initial was 0)
      });
    });

    it("should handle V2 events without upcasting", async () => {
      // Open account and deposit with V2 (current) schema
      const { id } = await hermes.command(new OpenAccount("Modern User", "EUR", 100));

      await hermes.command(new DepositFunds(300, "EUR"), { id });

      const aggregate = await hermes.admin.inspect.aggregate({
        id,
        name: "account_aggregate",
      });

      expect(aggregate.numberOfLoadedEvents).toBe(2);
      expect(aggregate.state).toEqual({
        ownerName: "Modern User",
        currency: "EUR",
        balance: 400, // 100 + 300
        status: "open",
        transactionCount: 2,
      });

      // Verify the stored event is V2
      const eventRepo = proteus.repository(EventRecord);
      const events = await eventRepo.find(
        {
          aggregateId: id,
          aggregateName: "account_aggregate",
          aggregateNamespace: "banking",
        },
        { order: { expectedEvents: "ASC" } },
      );

      const depositEvent = events.find((e) => e.name === "funds_deposited");
      expect(depositEvent).toBeDefined();
      expect(depositEvent!.version).toBe(2);
      expect(depositEvent!.data).toEqual(
        expect.objectContaining({ amount: 300, currency: "EUR" }),
      );
    });

    it("should upcast V1 and then accept new V2 deposits on the same aggregate", async () => {
      // Open account
      const { id } = await hermes.command(new OpenAccount("Mixed User", "GBP", 100));

      // Seed a legacy V1 event
      const eventRepo = proteus.repository(EventRecord);
      const existingEvents = await eventRepo.find(
        {
          aggregateId: id,
          aggregateName: "account_aggregate",
          aggregateNamespace: "banking",
        },
        { order: { expectedEvents: "ASC" } },
      );

      const lastEvent = existingEvents[existingEvents.length - 1];

      const legacyRecord = new EventRecord();
      legacyRecord.id = randomUUID();
      legacyRecord.aggregateId = id;
      legacyRecord.aggregateName = "account_aggregate";
      legacyRecord.aggregateNamespace = "banking";
      legacyRecord.causationId = randomUUID();
      legacyRecord.correlationId = "";
      legacyRecord.data = { amount: 50 };
      legacyRecord.encrypted = false;
      legacyRecord.name = "funds_deposited";
      legacyRecord.version = 1;
      legacyRecord.timestamp = new Date();
      legacyRecord.expectedEvents = existingEvents.length;
      legacyRecord.meta = {};
      legacyRecord.previousId = lastEvent.id;
      legacyRecord.checksum = "";

      await eventRepo.insert([legacyRecord]);

      // Now issue a new V2 deposit command on top of the aggregate
      // that has a mix of V1 and AccountOpened events
      await hermes.command(new DepositFunds(200, "GBP"), { id });

      const aggregate = await hermes.admin.inspect.aggregate({
        id,
        name: "account_aggregate",
      });

      expect(aggregate.numberOfLoadedEvents).toBe(3);
      expect(aggregate.state).toEqual({
        ownerName: "Mixed User",
        currency: "GBP",
        balance: 350, // 100 + 50 (upcasted V1) + 200 (V2)
        status: "open",
        transactionCount: 3,
      });
    });
  });

  // --------------------------------------------------------------------------
  // Full lifecycle scenario (end-to-end narrative)
  // --------------------------------------------------------------------------

  describe("Full banking lifecycle", () => {
    it("should process open -> deposits -> withdrawal -> close", async () => {
      // Step 1: Open account
      const { id } = await hermes.command(new OpenAccount("Alice Johnson", "USD", 500));

      // Step 2: Three deposits
      await hermes.command(new DepositFunds(200, "USD"), { id });
      await hermes.command(new DepositFunds(150, "USD"), { id });
      await hermes.command(new DepositFunds(50, "USD"), { id });

      // Verify balance: 500 + 200 + 150 + 50 = 900
      let view = await hermes.admin.inspect.view({
        id,
        entity: AccountSummaryView,
      });

      expect(view!.balance).toBe(900);
      expect(view!.transactionCount).toBe(4);

      // Step 3: Withdraw $800 (triggers low balance warning in saga)
      await hermes.command(new WithdrawFunds(800), { id });

      view = await hermes.admin.inspect.view({
        id,
        entity: AccountSummaryView,
      });

      expect(view!.balance).toBe(100);
      expect(view!.transactionCount).toBe(5);

      // Verify saga state
      const sagaState = await hermes.admin.inspect.saga({
        id,
        name: "overdraft_protection_saga",
      });

      expect(sagaState!.state).toEqual(
        expect.objectContaining({
          balance: 100,
          lowBalanceWarning: false, // exactly 100 is NOT below 100
        }),
      );

      // Step 4: Withdraw remaining balance
      await hermes.command(new WithdrawFunds(100), { id });

      view = await hermes.admin.inspect.view({
        id,
        entity: AccountSummaryView,
      });

      expect(view!.balance).toBe(0);

      // Step 5: Close account
      await hermes.command(new CloseAccount(), { id });

      // Verify final aggregate state
      const finalAggregate = await hermes.admin.inspect.aggregate({
        id,
        name: "account_aggregate",
      });

      expect(finalAggregate.destroyed).toBe(true);
      // 8 events: open + 3 deposits + 2 withdrawals + account_flagged (saga dispatch) + close
      expect(finalAggregate.numberOfLoadedEvents).toBe(8);
      expect(finalAggregate.state).toEqual({
        ownerName: "Alice Johnson",
        currency: "USD",
        balance: 0,
        status: "closed",
        transactionCount: 6,
      });

      // Verify final view state
      const finalView = await hermes.admin.inspect.view({
        id,
        entity: AccountSummaryView,
      });

      expect(finalView!.destroyed).toBe(true);
      expect(finalView!.status).toBe("closed");
      expect(finalView!.balance).toBe(0);

      // Verify final saga state
      const finalSaga = await hermes.admin.inspect.saga({
        id,
        name: "overdraft_protection_saga",
      });

      expect(finalSaga!.destroyed).toBe(true);
    });
  });
});
