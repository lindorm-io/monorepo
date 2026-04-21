import { describe, expect, test } from "vitest";
import type { EntityMetadata, MetaField } from "../../../entity/types/metadata.js";
import {
  compileAggregationPipeline,
  compilePredicatesToFilter,
} from "./compile-aggregation-pipeline.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeField = (key: string, name?: string): MetaField =>
  ({
    key,
    name: name ?? key,
    type: "string",
  }) as unknown as MetaField;

const makeMetadata = (
  fields: Array<MetaField>,
  primaryKeys: Array<string> = ["id"],
): EntityMetadata =>
  ({
    entity: { name: "TestEntity" },
    fields,
    primaryKeys,
    relations: [],
    inheritance: null,
  }) as unknown as EntityMetadata;

const metadata = makeMetadata([
  makeField("id"),
  makeField("name"),
  makeField("category"),
  makeField("amount", "amount"),
  makeField("status"),
]);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("compilePredicatesToFilter", () => {
  test("should return empty filter for no predicates", () => {
    expect(compilePredicatesToFilter([], metadata)).toMatchSnapshot();
  });

  test("should compile single AND predicate", () => {
    expect(
      compilePredicatesToFilter(
        [{ predicate: { name: "foo" }, conjunction: "and" }],
        metadata,
      ),
    ).toMatchSnapshot();
  });

  test("should compile multiple AND predicates", () => {
    expect(
      compilePredicatesToFilter(
        [
          { predicate: { name: "foo" }, conjunction: "and" } as any,
          { predicate: { status: "active" }, conjunction: "and" } as any,
        ],
        metadata,
      ),
    ).toMatchSnapshot();
  });

  test("should compile OR predicates", () => {
    expect(
      compilePredicatesToFilter(
        [
          { predicate: { name: "foo" }, conjunction: "or" } as any,
          { predicate: { name: "bar" }, conjunction: "or" } as any,
        ],
        metadata,
      ),
    ).toMatchSnapshot();
  });

  test("should compile mixed AND and OR predicates", () => {
    expect(
      compilePredicatesToFilter(
        [
          { predicate: { status: "active" }, conjunction: "and" } as any,
          { predicate: { name: "foo" }, conjunction: "or" } as any,
        ],
        metadata,
      ),
    ).toMatchSnapshot();
  });
});

describe("compileAggregationPipeline", () => {
  test("should produce $match stage from filter", () => {
    expect(
      compileAggregationPipeline({
        filter: { status: "active" },
        groupByFields: ["category"],
        aggregateSelections: [{ fn: "$sum", field: "amount", alias: "total" }],
        having: [],
        orderBy: null,
        skip: null,
        take: null,
        metadata,
      }),
    ).toMatchSnapshot();
  });

  test("should omit $match stage for empty filter", () => {
    const pipeline = compileAggregationPipeline({
      filter: {},
      groupByFields: ["category"],
      aggregateSelections: [{ fn: "$sum", field: "amount", alias: "total" }],
      having: [],
      orderBy: null,
      skip: null,
      take: null,
      metadata,
    });

    expect(pipeline.find((s) => "$match" in s)).toBeUndefined();
    expect(pipeline).toMatchSnapshot();
  });

  test("should produce $group stage with group-by fields", () => {
    expect(
      compileAggregationPipeline({
        filter: {},
        groupByFields: ["category", "status"],
        aggregateSelections: [{ fn: "$sum", field: "amount", alias: "total" }],
        having: [],
        orderBy: null,
        skip: null,
        take: null,
        metadata,
      }),
    ).toMatchSnapshot();
  });

  test("should handle COUNT(*) as $sum: 1", () => {
    expect(
      compileAggregationPipeline({
        filter: {},
        groupByFields: ["category"],
        aggregateSelections: [{ fn: "$sum", field: "*", alias: "count" }],
        having: [],
        orderBy: null,
        skip: null,
        take: null,
        metadata,
      }),
    ).toMatchSnapshot();
  });

  test("should produce $sort, $skip, and $limit stages", () => {
    expect(
      compileAggregationPipeline({
        filter: {},
        groupByFields: ["category"],
        aggregateSelections: [{ fn: "$sum", field: "amount", alias: "total" }],
        having: [],
        orderBy: { category: "ASC" } as any,
        skip: 10,
        take: 5,
        metadata,
      }),
    ).toMatchSnapshot();
  });

  test("should not add $skip for zero or null skip", () => {
    const pipeline = compileAggregationPipeline({
      filter: {},
      groupByFields: ["category"],
      aggregateSelections: [{ fn: "$sum", field: "amount", alias: "total" }],
      having: [],
      orderBy: null,
      skip: 0,
      take: null,
      metadata,
    });

    expect(pipeline.find((s) => "$skip" in s)).toBeUndefined();
  });

  test("should produce $project stage exposing group-by fields from _id", () => {
    const pipeline = compileAggregationPipeline({
      filter: {},
      groupByFields: ["category"],
      aggregateSelections: [{ fn: "$sum", field: "amount", alias: "total" }],
      having: [],
      orderBy: null,
      skip: null,
      take: null,
      metadata,
    });

    const projectStage = pipeline.find((s) => "$project" in s);
    expect(projectStage).toMatchSnapshot();
  });

  test("should use null _id for no group-by fields", () => {
    expect(
      compileAggregationPipeline({
        filter: {},
        groupByFields: [],
        aggregateSelections: [{ fn: "$sum", field: "amount", alias: "total" }],
        having: [],
        orderBy: null,
        skip: null,
        take: null,
        metadata,
      }),
    ).toMatchSnapshot();
  });

  test("should map PK fields to _id in group-by", () => {
    expect(
      compileAggregationPipeline({
        filter: {},
        groupByFields: ["id"],
        aggregateSelections: [{ fn: "$sum", field: "amount", alias: "total" }],
        having: [],
        orderBy: null,
        skip: null,
        take: null,
        metadata,
      }),
    ).toMatchSnapshot();
  });

  test("should add $match for having conditions", () => {
    expect(
      compileAggregationPipeline({
        filter: {},
        groupByFields: ["category"],
        aggregateSelections: [{ fn: "$sum", field: "amount", alias: "total" }],
        having: [{ predicate: { total: { $gt: 100 } } as any, conjunction: "and" }],
        orderBy: null,
        skip: null,
        take: null,
        metadata,
      }),
    ).toMatchSnapshot();
  });
});
