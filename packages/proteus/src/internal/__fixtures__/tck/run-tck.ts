// TCK Runner
//
// Wires up all TCK suites with capability gating.
// Each driver harness calls runTck() with its factory and ProteusSource accessor.
//
// Naming-strategy coverage is redistributed one-strategy-per-driver (none →
// sqlite/mongo/redis/memory, snake → postgres, camel → mysql) because
// applyNamingStrategy is a shared, driver-agnostic resolver — proving a strategy
// once suffices. See ./NAMING.md for the full rationale, strategy→driver map, and
// residual-risk note.

import { afterAll, beforeAll, describe, test, vi } from "vitest";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { TckCapabilities, TckDriverFactory, TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";
import type { ProteusSource } from "../../../classes/ProteusSource.js";
import type { NamingStrategy } from "../../../types/source-options.js";
import { createTckEntities } from "./create-tck-entities.js";

import { crudSuite } from "./crud.tck.js";
import { generatedKeysSuite } from "./generated-keys.tck.js";
import { queriesSuite } from "./queries.tck.js";
import { softDeleteSuite } from "./soft-delete.tck.js";
import { versioningSuite } from "./versioning.tck.js";
import { relationsOneToOneSuite } from "./relations-one-to-one.tck.js";
import { relationsOneToManySuite } from "./relations-one-to-many.tck.js";
import { relationsManyToManySuite } from "./relations-many-to-many.tck.js";
import { aggregatesSuite } from "./aggregates.tck.js";
import { incrementsSuite } from "./increments.tck.js";
import { upsertSuite } from "./upsert.tck.js";
import { cursorSuite } from "./cursor.tck.js";
import { expirySuite } from "./expiry.tck.js";
import { hooksSuite } from "./hooks.tck.js";
import { edgeCasesSuite } from "./edge-cases.tck.js";
import {
  transactionsRollbackSuite,
  transactionsSavepointsSuite,
} from "./transactions.tck.js";
import { queryBuilderSuite } from "./query-builder.tck.js";
import { scopeSuite } from "./scope.tck.js";
import { lazyLoadingSuite } from "./lazy-loading.tck.js";
import { embeddedListLoadingSuite } from "./embedded-list-loading.tck.js";
import { unversionedSuite } from "./unversioned.tck.js";
import { streamSuite } from "./stream.tck.js";
import { clearSuite } from "./clear.tck.js";
import { uniqueConstraintsSuite } from "./unique-constraints.tck.js";
import { foreignKeysSuite } from "./foreign-keys.tck.js";
import {
  inheritanceSingleTableSuite,
  inheritanceJoinedSuite,
} from "./inheritance.tck.js";
import { complexPredicatesSuite } from "./complex-predicates.tck.js";
import { typedJsonSuite } from "./typed-json.tck.js";
import { transformSuite } from "./transform.tck.js";
import { encryptionSuite } from "./encryption.tck.js";
import { typeCoercionSuite } from "./type-coercion.tck.js";
import { arrayTypeSuite } from "./array-type.tck.js";
import { renamedColumnsSuite } from "./renamed-columns.tck.js";
import { checkConstraintsSuite } from "./check-constraints.tck.js";
import { bigintIdentitySuite } from "./bigint-identity.tck.js";

const maybeDescribe = (flag: boolean, name: string, fn: () => void) => {
  if (flag) {
    describe(name, fn);
  }
};

/**
 * Run the full conformance suite for a driver. When `namings` has more than one
 * entry, the entire suite is replayed under each naming strategy in its own
 * `describe` block — turning the behavioural assertions into a free key→column
 * resolution fuzzer. Each naming gets a fresh set of entity classes + hook spy
 * so the runs are fully isolated.
 *
 * Each driver is assigned a SINGLE strategy (the resolver is shared/driver-
 * agnostic, so proving a strategy once is enough — see ./NAMING.md). Passing
 * more than one is supported but should stay the exception (it multiplies replay
 * cost per worker).
 */
export const runTck = (
  factory: TckDriverFactory,
  getSource: () => ProteusSource,
  namings: ReadonlyArray<NamingStrategy> = ["none"],
) => {
  for (const naming of namings) {
    describe(`naming: ${naming}`, () => {
      runTckForNaming(factory, getSource, naming);
    });
  }
};

const runTckForNaming = (
  factory: TckDriverFactory,
  getSource: () => ProteusSource,
  naming: NamingStrategy,
) => {
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
    entities.TckReadonlyScoped,
    entities.TckFkParent,
    entities.TckFkCascadeChild,
    entities.TckFkRestrictChild,
    entities.TckFkNullifyChild,
    entities.TckFkAutoNullableChild,
    entities.TckCascadeParent,
    entities.TckCascadeChild,
    entities.TckArrayHolder,
    entities.TckJsonbArray,
    entities.TckJsonHolder,
    entities.TckTypedJson,
    entities.TckWithAddress,
    entities.TckTransformed,
    entities.TckTypeHolder,
    entities.TckArrayTypes,
    entities.TckRenamedColumns,
    entities.TckChecked,
    entities.TckPkString,
    entities.TckPkIncrement,
    entities.TckPkInteger,
  ];

  // Encryption test entities
  if (caps.encryption) {
    baseTargets.push(entities.TckEncrypted, entities.TckStagedEncrypted);
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

  // BigInt auto-increment identity entities (only registered where the driver
  // mints and round-trips a bigint identity)
  if (caps.bigintIdentity) {
    baseTargets.push(
      entities.TckBigIntPkParent,
      entities.TckBigIntPkChild,
      entities.TckBigIntPkDeclaredChild,
    );
  }

  const allTargets = baseTargets;

  beforeAll(async () => {
    handle = await factory.setup(allTargets, naming);
  });

  afterAll(async () => {
    await handle.teardown();
  });

  // Always-on suites
  crudSuite(getHandle, entities);
  generatedKeysSuite(getHandle, entities);
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
  upsertSuite(getHandle, entities, caps);
  complexPredicatesSuite(getHandle, entities);
  arrayTypeSuite(getHandle, entities);
  renamedColumnsSuite(getHandle, entities);
  transformSuite(getHandle, entities);

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
  maybeDescribe(caps.bigintIdentity, "bigintIdentity", () =>
    bigintIdentitySuite(getHandle, entities, caps),
  );
  maybeDescribe(caps.checkConstraints, "checkConstraints", () =>
    checkConstraintsSuite(getHandle, entities),
  );
  // The suite gates each column type on its own flag; the wrapper only keeps
  // the describe out of the report when a driver carries none of them.
  maybeDescribe(
    caps.bigintColumns || caps.decimalColumns || caps.binaryColumns,
    "typeCoercion",
    () => typeCoercionSuite(getHandle, entities, caps),
  );
  // @TypedJson has its own flag: the sidecar carries nested bigint / Buffer /
  // Date through a JSON-safe data half, so it does not depend on the driver's
  // native bigint / decimal / binary column support.
  maybeDescribe(caps.typedJson, "typedJson", () => typedJsonSuite(getHandle, entities));
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
