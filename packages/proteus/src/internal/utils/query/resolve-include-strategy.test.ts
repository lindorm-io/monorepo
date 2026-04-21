import { describe, expect, test } from "vitest";
import type {
  EntityMetadata,
  MetaRelation,
  RelationStrategy,
} from "../../entity/types/metadata.js";
import { resolveIncludeStrategy } from "./resolve-include-strategy.js";

const makeRelation = (
  key: string,
  type: MetaRelation["type"],
  strategy: RelationStrategy | null = null,
): MetaRelation =>
  ({
    key,
    type,
    options: { strategy },
  }) as unknown as MetaRelation;

const makeMetadata = (relations: Array<MetaRelation>): EntityMetadata =>
  ({ relations }) as unknown as EntityMetadata;

describe("resolveIncludeStrategy", () => {
  test("should return override when provided", () => {
    const metadata = makeMetadata([makeRelation("posts", "OneToMany")]);
    expect(resolveIncludeStrategy("posts", metadata, "query")).toBe("query");
  });

  test("should return decorator strategy when no override", () => {
    const metadata = makeMetadata([makeRelation("posts", "OneToMany", "query")]);
    expect(resolveIncludeStrategy("posts", metadata)).toBe("query");
  });

  test("should return decorator strategy over default", () => {
    const metadata = makeMetadata([makeRelation("author", "ManyToOne", "query")]);
    expect(resolveIncludeStrategy("author", metadata)).toBe("query");
  });

  test("should default to join for ManyToOne", () => {
    const metadata = makeMetadata([makeRelation("author", "ManyToOne")]);
    expect(resolveIncludeStrategy("author", metadata)).toBe("join");
  });

  test("should default to join for OneToOne", () => {
    const metadata = makeMetadata([makeRelation("profile", "OneToOne")]);
    expect(resolveIncludeStrategy("profile", metadata)).toBe("join");
  });

  test("should default to query for OneToMany", () => {
    const metadata = makeMetadata([makeRelation("posts", "OneToMany")]);
    expect(resolveIncludeStrategy("posts", metadata)).toBe("query");
  });

  test("should default to query for ManyToMany", () => {
    const metadata = makeMetadata([makeRelation("tags", "ManyToMany")]);
    expect(resolveIncludeStrategy("tags", metadata)).toBe("query");
  });

  test("should return join for unknown relation key", () => {
    const metadata = makeMetadata([]);
    expect(resolveIncludeStrategy("unknown", metadata)).toBe("join");
  });

  test("should prefer override over decorator strategy", () => {
    const metadata = makeMetadata([makeRelation("posts", "OneToMany", "join")]);
    expect(resolveIncludeStrategy("posts", metadata, "query")).toBe("query");
  });
});
