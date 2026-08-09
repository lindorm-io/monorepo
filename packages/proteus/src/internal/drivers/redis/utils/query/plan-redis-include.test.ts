import type { Constructor, Dict } from "@lindorm/types";
import { beforeAll, describe, expect, test } from "vitest";
import { Entity } from "../../../../../decorators/Entity.js";
import { Field } from "../../../../../decorators/Field.js";
import { Generated } from "../../../../../decorators/Generated.js";
import { JoinTable } from "../../../../../decorators/JoinTable.js";
import { ManyToMany } from "../../../../../decorators/ManyToMany.js";
import { ManyToOne } from "../../../../../decorators/ManyToOne.js";
import { Nullable } from "../../../../../decorators/Nullable.js";
import { OneToMany } from "../../../../../decorators/OneToMany.js";
import { PrimaryKeyField } from "../../../../../decorators/PrimaryKeyField.js";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { NamingStrategy } from "../../../../../types/source-options.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";
import { registerMetadataResolver } from "../../../../entity/metadata/foreign-metadata.js";
import { applyNamingStrategy } from "../../../../utils/naming/apply-naming-strategy.js";
import { planRedisInclude } from "./plan-redis-include.js";

@Entity({ name: "plan_post" })
class PlanPost {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string") title!: string;

  @ManyToOne(() => PlanUser, "posts")
  author!: PlanUser | null;

  @Nullable() @Field("uuid") authorId!: string | null;
}

@Entity({ name: "plan_user" })
class PlanUser {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string") name!: string;

  @OneToMany(() => PlanPost, "author")
  posts!: Array<PlanPost>;
}

@Entity({ name: "plan_right" })
class PlanRight {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string") label!: string;

  @ManyToMany(() => PlanLeft, "rights")
  lefts!: Array<PlanLeft>;
}

@Entity({ name: "plan_left" })
class PlanLeft {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string") label!: string;

  @JoinTable()
  @ManyToMany(() => PlanRight, "lefts")
  rights!: Array<PlanRight>;
}

const include = (relation: string, strategy: "join" | "query" = "join") => ({
  relation,
  required: false,
  strategy,
  select: null,
  where: null,
});

/**
 * Resolve metadata the way a source does — every entity through ONE naming
 * resolver, registered so foreign metadata follows the same strategy. Without
 * that, a plan would name keys under "snake" out of raw metadata.
 */
const resolveAll = (
  naming: NamingStrategy,
): Map<Constructor<IEntity>, EntityMetadata> => {
  const targets = [PlanPost, PlanUser, PlanLeft, PlanRight] as Array<
    Constructor<IEntity>
  >;
  const resolved = new Map<Constructor<IEntity>, EntityMetadata>();
  const resolve = (target: Constructor<IEntity>): EntityMetadata => resolved.get(target)!;

  for (const target of targets) {
    resolved.set(target, applyNamingStrategy(getEntityMetadata(target), naming));
  }
  for (const metadata of resolved.values()) {
    registerMetadataResolver(metadata, resolve as never);
  }

  return resolved;
};

describe.each(["none", "snake"] as const)("planRedisInclude (naming: %s)", (naming) => {
  let metadata: Map<Constructor<IEntity>, EntityMetadata>;

  beforeAll(() => {
    metadata = resolveAll(naming);
  });

  // The root row carries the foreign key and the foreign key IS the target's
  // primary key, so the key pattern addresses the row outright — the one case
  // Redis has an index for.
  test("an owning to-one addresses the foreign hashes by key, with no scan", () => {
    const rows: Array<Dict> = [
      { id: "p1", authorId: "u1" },
      { id: "p2", authorId: "u2" },
      { id: "p3", authorId: "u1" },
    ];

    const plan = planRedisInclude(rows, include("author"), {
      rootMetadata: metadata.get(PlanPost as never)!,
      namespace: "ns",
    });

    expect(plan.scanPattern).toBeNull();
    expect(plan.isCollection).toBe(false);
    expect(plan.pairs).toEqual([{ localKey: "authorId", foreignKey: "id" }]);
    // Distinct, so the repeated author costs no second HGETALL.
    expect(plan.hashKeys).toEqual(["ns:entity:plan_user:u1", "ns:entity:plan_user:u2"]);
  });

  // A null foreign key points at nothing, and `encodePkSegment` would reject it
  // besides — so it must never reach the plan as a key.
  test("a root with a null foreign key contributes no key", () => {
    const plan = planRedisInclude([{ id: "p1", authorId: null }], include("author"), {
      rootMetadata: metadata.get(PlanPost as never)!,
      namespace: null,
    });

    expect(plan.hashKeys).toEqual([]);
    expect(plan.scanPattern).toBeNull();
  });

  // The foreign key lives in an ordinary hash field with nothing pointing at
  // it, so the only way to find the rows is to walk the keyspace.
  test("an inverse relation has no index and falls back to a scan", () => {
    const plan = planRedisInclude([{ id: "u1" }], include("posts"), {
      rootMetadata: metadata.get(PlanUser as never)!,
      namespace: "ns",
    });

    expect(plan.hashKeys).toEqual([]);
    expect(plan.scanPattern).toBe("ns:entity:plan_post:*");
    expect(plan.isCollection).toBe(true);
    expect(plan.pairs).toEqual([{ localKey: "id", foreignKey: "authorId" }]);
  });

  // The join SETs ARE an index, so a many-to-many costs no scan — it costs a
  // second hop instead, because the members name the targets.
  test("a many-to-many reads both join SETs per root and addresses members by key", () => {
    const rows: Array<Dict> = [{ id: "l1" }, { id: "l2" }];

    const plan = planRedisInclude(rows, include("rights"), {
      rootMetadata: metadata.get(PlanLeft as never)!,
      namespace: "ns",
    });

    expect(plan.scanPattern).toBeNull();
    expect(plan.hashKeys).toEqual([]);
    // The SET keys and the member key are pinned verbatim, because they are the
    // exact strings createRedisJoinTableOps writes — a divergence in either
    // spelling reads an empty relation rather than failing.
    expect({
      link: plan.link,
      sets: plan.linkSets.map((set) => [set.forward, set.reverse]),
      memberKey: plan.memberKey!("r9"),
    }).toMatchSnapshot();
  });

  // The strategy is a round-trip shape and nothing else: the same keys are read
  // either way, so the plan must not vary with it.
  test("the plan is identical under both strategies", () => {
    const rows: Array<Dict> = [{ id: "p1", authorId: "u1" }];
    const root = metadata.get(PlanPost as never)!;

    const joined = planRedisInclude(rows, include("author", "join"), {
      rootMetadata: root,
      namespace: null,
    });
    const queried = planRedisInclude(rows, include("author", "query"), {
      rootMetadata: root,
      namespace: null,
    });

    expect(joined.hashKeys).toEqual(queried.hashKeys);
    expect(joined.scanPattern).toEqual(queried.scanPattern);
    expect(joined.pairs).toEqual(queried.pairs);
  });
});
