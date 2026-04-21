import type { StagedMetadata } from "../internal/metadata/index.js";
import { Query } from "./Query.js";
import { describe, expect, test } from "vitest";

const createMockContext = (metadata: DecoratorMetadataObject): ClassDecoratorContext =>
  ({ metadata }) as ClassDecoratorContext;

describe("Query", () => {
  test("should stage dto metadata with snake_case name derived from class name", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestViewQuery {}

    Query()(TestViewQuery, createMockContext(metadata));

    expect(metadata).toMatchSnapshot();
  });

  test("should stage dto metadata with custom name when provided as string", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestViewQuery {}

    Query("custom_query_name")(TestViewQuery, createMockContext(metadata));

    expect(metadata).toMatchSnapshot();
  });

  test("should always set version to 1", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestQueryCreate_V2 {}

    Query()(TestQueryCreate_V2, createMockContext(metadata));

    // Query does not support version option -- always 1
    expect((metadata as StagedMetadata).dto!.version).toBe(1);
  });
});
