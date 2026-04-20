// TCK Runner
//
// Wires up all TCK suites with capability gating.
// Each driver harness calls runTck() with its factory and ProteusSource accessor.

import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../interfaces";
import type { TckCapabilities, TckDriverFactory, TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";
import type { ProteusSource } from "../../../classes/ProteusSource";
import { createTckEntities } from "./create-tck-entities";

import { crudSuite } from "./crud.tck";
import { queriesSuite } from "./queries.tck";
import { softDeleteSuite } from "./soft-delete.tck";
import { versioningSuite } from "./versioning.tck";
import { relationsOneToOneSuite } from "./relations-one-to-one.tck";
import { relationsOneToManySuite } from "./relations-one-to-many.tck";
import { relationsManyToManySuite } from "./relations-many-to-many.tck";
import { aggregatesSuite } from "./aggregates.tck";
import { incrementsSuite } from "./increments.tck";
import { upsertSuite } from "./upsert.tck";
import { cursorSuite } from "./cursor.tck";
import { expirySuite } from "./expiry.tck";
import { hooksSuite } from "./hooks.tck";
import { edgeCasesSuite } from "./edge-cases.tck";
import {
  transactionsRollbackSuite,
  transactionsSavepointsSuite,
} from "./transactions.tck";
import { queryBuilderSuite } from "./query-builder.tck";
import { scopeSuite } from "./scope.tck";
import { lazyLoadingSuite } from "./lazy-loading.tck";
import { embeddedListLoadingSuite } from "./embedded-list-loading.tck";
import { unversionedSuite } from "./unversioned.tck";
import { streamSuite } from "./stream.tck";
import { clearSuite } from "./clear.tck";
import { uniqueConstraintsSuite } from "./unique-constraints.tck";
import { foreignKeysSuite } from "./foreign-keys.tck";
import { inheritanceSingleTableSuite, inheritanceJoinedSuite } from "./inheritance.tck";
import { complexPredicatesSuite } from "./complex-predicates.tck";
import { encryptionSuite } from "./encryption.tck";

const maybeDescribe = (flag: boolean, name: string, fn: () => void) => {
  if (flag) {
    describe(name, fn);
  }
};

export const runTck = (factory: TckDriverFactory, getSource: () => ProteusSource) => {
  const hookCallback = vi.fn();
  const entities = createTckEntities(hookCallback);
  const caps = factory.capabilities;

  let handle: TckDriverHandle;

  const getHandle = () => handle;

  // Base targets included for all drivers
  const baseTargets: Array<Constructor<IEntity>> = [
    entities.TckSimpleUser,
    entities.TckSimplePost,
    entities.TckSoftDeletable,
    entities.TckExpirable,
    entities.TckVersionKeyed,
    entities.TckOwner,
    entities.TckDetail,
    entities.TckLeft,
    entities.TckRight,
    entities.TckLazyUser,
    entities.TckLazyPost,
    entities.TckLazyOwner,
    entities.TckLazyDetail,
    entities.TckLazyLeft,
    entities.TckLazyRight,
    entities.TckScopedUser,
    entities.TckScopedPost,
    entities.TckHooked,
    entities.TckScoped,
    entities.TckUnversioned,
    entities.TckUniqueConstrained,
    entities.TckUniqueComposite,
    entities.TckFkParent,
    entities.TckFkCascadeChild,
    entities.TckFkRestrictChild,
    entities.TckFkNullifyChild,
    entities.TckCascadeParent,
    entities.TckCascadeChild,
    entities.TckArrayHolder,
    entities.TckJsonHolder,
    entities.TckWithAddress,
  ];

  // Encryption test entity
  if (caps.encryption) {
    baseTargets.push(entities.TckEncrypted);
  }

  // Single-table inheritance entities (all drivers)
  if (caps.inheritance.singleTable) {
    baseTargets.push(entities.TckVehicle, entities.TckCar, entities.TckTruck);
  }

  // Joined inheritance entities (PG + Memory only — Redis throws NotSupportedError)
  if (caps.inheritance.joined) {
    baseTargets.push(entities.TckAnimal, entities.TckDog, entities.TckCat);
  }

  // Embedded list loading entities (all drivers except redis)
  if (caps.embeddedLists) {
    baseTargets.push(
      entities.TckElDefault,
      entities.TckElEagerMultiple,
      entities.TckElLazySingle,
      entities.TckElEager,
    );
  }

  const allTargets = baseTargets;

  beforeAll(async () => {
    handle = await factory.setup(allTargets);
  });

  afterAll(async () => {
    await handle.teardown();
  });

  // Always-on suites
  crudSuite(getHandle, entities);
  queriesSuite(getHandle, entities);
  aggregatesSuite(getHandle, entities);
  hooksSuite(getHandle, entities, hookCallback);
  edgeCasesSuite(getHandle, entities);
  unversionedSuite(getHandle, entities);
  clearSuite(getHandle, entities);
  scopeSuite(getHandle, entities);
  streamSuite(getHandle, entities);
  relationsOneToOneSuite(getHandle, entities);
  relationsOneToManySuite(getHandle, entities);
  relationsManyToManySuite(getHandle, entities);
  upsertSuite(getHandle, entities);
  complexPredicatesSuite(getHandle, entities);

  // Capability-gated suites
  maybeDescribe(caps.softDelete, "softDelete", () =>
    softDeleteSuite(getHandle, entities),
  );
  maybeDescribe(caps.versioning, "versioning", () =>
    versioningSuite(getHandle, entities),
  );
  maybeDescribe(caps.atomicIncrements, "atomicIncrements", () =>
    incrementsSuite(getHandle, entities),
  );
  maybeDescribe(caps.cursor, "cursor", () => cursorSuite(getHandle, entities));
  maybeDescribe(caps.expiry, "expiry", () => expirySuite(getHandle, entities));
  maybeDescribe(caps.queryBuilder, "queryBuilder", () =>
    queryBuilderSuite(getHandle, entities, getSource),
  );
  maybeDescribe(caps.lazyLoading, "lazyLoading", () =>
    lazyLoadingSuite(getHandle, entities),
  );
  maybeDescribe(caps.embeddedLists, "embeddedListLoading", () =>
    embeddedListLoadingSuite(getHandle, entities),
  );
  maybeDescribe(caps.uniqueEnforcement, "uniqueEnforcement", () =>
    uniqueConstraintsSuite(getHandle, entities),
  );
  maybeDescribe(caps.referentialIntegrity, "referentialIntegrity", () =>
    foreignKeysSuite(getHandle, entities),
  );
  maybeDescribe(caps.inheritance.singleTable, "inheritance:single-table", () =>
    inheritanceSingleTableSuite(getHandle, entities),
  );
  maybeDescribe(caps.inheritance.joined, "inheritance:joined", () =>
    inheritanceJoinedSuite(getHandle, entities, getSource),
  );
  maybeDescribe(caps.encryption, "encryption", () =>
    encryptionSuite(getHandle, entities),
  );
  maybeDescribe(caps.transactions.rollback, "transactions:rollback", () =>
    transactionsRollbackSuite(getHandle, entities, getSource),
  );
  maybeDescribe(caps.transactions.savepoints, "transactions:savepoints", () =>
    transactionsSavepointsSuite(getHandle, entities, getSource),
  );
};
