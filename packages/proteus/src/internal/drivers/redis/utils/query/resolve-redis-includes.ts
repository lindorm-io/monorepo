import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import type { Redis } from "ioredis";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../../types/query.js";
import type { RowIncludeMatch } from "../../../../utils/query/attach-row-includes.js";
import { applyOrdering } from "../../../../utils/query/apply-ordering.js";
import { filterRelationRows } from "../../../../utils/query/filter-relation-rows.js";
import { indexAndMatch } from "../../../../utils/query/match-relation-rows.js";
import { deserializeHash } from "../deserialize-hash.js";
import { scanEntityKeys } from "../scan-entity-keys.js";
import { planRedisInclude, type RedisIncludePlan } from "./plan-redis-include.js";
import {
  createRedisReader,
  type RedisReader,
  type RedisReadResult,
} from "./redis-include-reader.js";

export type RedisIncludeContext = {
  rootMetadata: EntityMetadata;
  client: Redis;
  namespace: string | null;
  withDeleted: boolean;
  versionTimestamp: Date | null;
  logger?: ILogger;
};

/**
 * Resolve the foreign rows every root row's included relations match.
 *
 * Redis has no query planner, so the work splits cleanly in two: a PLAN decides
 * which keys hold the answer, and a READER decides how many round trips those
 * keys take. `strategy` reaches the reader alone — the plan is the same either
 * way — so "join" and "query" read the identical keys and cannot land on
 * different entities. Everything after the reads is in process, exactly as the
 * memory driver does it, through the same filtering and matching helpers.
 *
 * Round trips, per relation type:
 *
 * - **owning to-one** (the root carries the foreign key): the key IS the index,
 *   so one HGETALL per distinct value — 1 round trip under "join", one per
 *   value under "query".
 * - **inverse** (the foreign row carries the key): nothing points at an
 *   ordinary hash field, so the foreign keyspace is SCANned first — a cursor
 *   loop that no strategy can batch away — and then read as above.
 * - **many-to-many**: the join SETs are a real index, so no scan. Two hops
 *   though, because the members name the targets: SMEMBERS of the forward and
 *   reverse SET per root, then HGETALL per distinct member. Under "join" that
 *   is 2 round trips whatever the row count.
 *
 * Under "join" every relation's first hop shares ONE pipeline and every second
 * hop shares a second, so a query is 1 trip, or 2 once a many-to-many is
 * included, plus one SCAN pass per relation that has no index.
 */
export const resolveRedisIncludes = async (
  rows: Array<Dict>,
  includes: Array<IncludeSpec>,
  ctx: RedisIncludeContext,
): Promise<Array<RowIncludeMatch>> => {
  if (includes.length === 0) return [];

  const plans = includes.map((include) =>
    planRedisInclude(rows, include, {
      rootMetadata: ctx.rootMetadata,
      namespace: ctx.namespace,
    }),
  );

  const matches = new Map<IncludeSpec, RowIncludeMatch>();

  // The two strategies read the same keys over different numbers of trips, so a
  // query mixing them resolves each set of relations through its own reader.
  for (const strategy of ["join", "query"] as const) {
    const group = plans.filter((plan) => plan.include.strategy === strategy);
    if (group.length === 0) continue;

    const reader = createRedisReader(strategy, ctx.client, ctx.logger);
    for (const match of await resolveGroup(rows, group, reader, ctx)) {
      matches.set(match.include, match);
    }
  }

  return includes.map((include) => matches.get(include)!);
};

const resolveGroup = async (
  rows: Array<Dict>,
  plans: Array<RedisIncludePlan>,
  reader: RedisReader,
  ctx: RedisIncludeContext,
): Promise<Array<RowIncludeMatch>> => {
  const scanned = await expandScans(plans, ctx);

  // First hop: everything the root rows alone can name — the hashes an owning
  // key addresses, the hashes a scan turned up, and the join SETs of every
  // many-to-many.
  const first = await reader({
    hashes: plans.flatMap((plan) => [
      ...plan.hashKeys,
      ...(plan.scanPattern ? (scanned.get(plan.scanPattern) ?? []) : []),
    ]),
    sets: plans.flatMap((plan) =>
      plan.linkSets.flatMap((set) => [set.forward, set.reverse]),
    ),
  });

  const members = new Map<RedisIncludePlan, Map<Dict, Array<string>>>();
  const memberKeys = new Map<RedisIncludePlan, Array<string>>();
  for (const plan of plans) {
    const linked = readLinkMembers(plan, first);
    members.set(plan, linked);
    memberKeys.set(
      plan,
      plan.memberKey ? [...distinctMembers(linked)].map(plan.memberKey) : [],
    );
  }

  // Second hop: the targets a many-to-many's members name, which nothing could
  // have known before the SETs were read.
  const second = await reader({
    hashes: plans.flatMap((plan) => memberKeys.get(plan)!),
    sets: [],
  });

  return plans.map((plan) =>
    matchPlan(rows, plan, {
      candidates: [
        ...readRows(plan, plan.hashKeys, first),
        ...(plan.scanPattern
          ? readRows(plan, scanned.get(plan.scanPattern) ?? [], first)
          : []),
        ...readRows(plan, memberKeys.get(plan)!, second),
      ],
      members: members.get(plan)!,
      ctx,
    }),
  );
};

/**
 * Expand the keyspaces that have no index to look in. Distinct patterns run
 * concurrently — a SCAN is a cursor loop, so it cannot join a pipeline, but
 * two relations' loops need not wait on each other.
 */
const expandScans = async (
  plans: Array<RedisIncludePlan>,
  ctx: RedisIncludeContext,
): Promise<Map<string, Array<string>>> => {
  const patterns = [
    ...new Set(
      plans
        .map((plan) => plan.scanPattern)
        .filter((pattern): pattern is string => pattern !== null),
    ),
  ];

  const results = await Promise.all(
    patterns.map((pattern) => scanEntityKeys(ctx.client, pattern)),
  );

  return new Map(patterns.map((pattern, index) => [pattern, results[index]]));
};

/** The many-to-many members each root row is linked to, forward SET and reverse unioned. */
const readLinkMembers = (
  plan: RedisIncludePlan,
  read: RedisReadResult,
): Map<Dict, Array<string>> => {
  const result = new Map<Dict, Array<string>>();

  for (const set of plan.linkSets) {
    result.set(set.row, [
      ...new Set([
        ...(read.sets.get(set.forward) ?? []),
        ...(read.sets.get(set.reverse) ?? []),
      ]),
    ]);
  }

  return result;
};

const distinctMembers = (members: Map<Dict, Array<string>>): Set<string> =>
  new Set([...members.values()].flat());

type PlanMatchOptions = {
  candidates: Array<Dict>;
  members: Map<Dict, Array<string>>;
  ctx: RedisIncludeContext;
};

const matchPlan = (
  rows: Array<Dict>,
  plan: RedisIncludePlan,
  options: PlanMatchOptions,
): RowIncludeMatch => {
  const candidates = filterRelationRows(
    options.candidates,
    plan.foreignMetadata,
    plan.include,
    {
      withDeleted: options.ctx.withDeleted,
      versionTimestamp: options.ctx.versionTimestamp,
    },
  );

  const matched = plan.link
    ? matchByMembers(rows, candidates, plan, options.members)
    : indexAndMatch(
        rows,
        candidates,
        plan.pairs.map((pair) => pair.localKey),
        plan.pairs.map((pair) => pair.foreignKey),
      );

  if (plan.relation.orderBy) {
    for (const [row, related] of matched) {
      matched.set(row, applyOrdering(related, plan.relation.orderBy));
    }
  }

  return {
    include: plan.include,
    relation: plan.relation,
    foreignMetadata: plan.foreignMetadata,
    isCollection: plan.isCollection,
    rows: matched,
  };
};

/**
 * The stored rows behind a set of keys. A key that no longer exists comes back
 * as an empty hash, which deserializes to nothing rather than to a row of nulls.
 */
const readRows = (
  plan: RedisIncludePlan,
  keys: Array<string>,
  read: RedisReadResult,
): Array<Dict> => {
  const rows: Array<Dict> = [];

  for (const key of keys) {
    const hash = read.hashes.get(key);
    if (!hash) continue;
    const row = deserializeHash(
      hash,
      plan.foreignMetadata.fields,
      plan.foreignMetadata.relations,
    );
    if (row) rows.push(row);
  }

  return rows;
};

/**
 * Match a many-to-many by its SET members. A member is a primary-key value as
 * Redis stored it — always a string — so the candidate index is keyed the same
 * way rather than by guessing the entity's own scalar type back.
 */
const matchByMembers = (
  rows: Array<Dict>,
  candidates: Array<Dict>,
  plan: RedisIncludePlan,
  members: Map<Dict, Array<string>>,
): Map<Dict, Array<Dict>> => {
  const byMember = new Map<string, Array<Dict>>();
  for (const candidate of candidates) {
    const value = candidate[plan.link!.foreignKey];
    if (value == null) continue;
    const key = String(value);
    const bucket = byMember.get(key);
    if (bucket) bucket.push(candidate);
    else byMember.set(key, [candidate]);
  }

  const result = new Map<Dict, Array<Dict>>();
  for (const row of rows) {
    result.set(
      row,
      (members.get(row) ?? []).flatMap((member) => byMember.get(member) ?? []),
    );
  }
  return result;
};
