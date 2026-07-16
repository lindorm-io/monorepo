import { describe, expect, test } from "vitest";
import { NotSupportedError } from "../../../errors/NotSupportedError.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import type { JoinedChildContext } from "./joined-child-context.js";
import type { SyncDialect } from "./sync-dialect.js";
import { projectIndexes } from "./project-indexes.js";

const dialect = (supportsPartialIndexes: boolean): SyncDialect =>
  ({
    supportsPartialIndexes,
    quoteIdentifier: (n: string) => `\`${n}\``,
    indexColumnPrefixLength: () => null,
  }) as unknown as SyncDialect;

const child = { isJoinedChild: false } as unknown as JoinedChildContext;

const metadata = (index: Record<string, unknown>): EntityMetadata =>
  ({
    indexes: [
      {
        keys: [{ key: "region", direction: "asc" }],
        name: "ix_region",
        unique: false,
        where: null,
        sparse: false,
        ...index,
      },
    ],
    fields: [{ key: "region", name: "region" }],
    primaryKeys: [],
  }) as unknown as EntityMetadata;

const project = (index: Record<string, unknown>, supportsPartialIndexes: boolean) =>
  projectIndexes({
    metadata: metadata(index),
    child,
    tableName: "t",
    dialect: dialect(supportsPartialIndexes),
  });

describe("projectIndexes — partial-index support", () => {
  test("keeps an explicit WHERE on a partial-index-capable driver", () => {
    expect(project({ where: "region <> 'x'" }, true)[0].where).toBe("region <> 'x'");
  });

  test("keeps a sparse-generated WHERE on a partial-index-capable driver", () => {
    expect(project({ sparse: true }, true)[0].where).toBe("`region` IS NOT NULL");
  });

  test("throws on an explicit WHERE when the driver has no partial indexes", () => {
    expect(() => project({ where: "region <> 'x'" }, false)).toThrowError(
      expect.objectContaining({ code: "unsupported_operation" }),
    );
  });

  test("throws on a UNIQUE sparse index when the driver has no partial indexes", () => {
    expect(() => project({ sparse: true, unique: true }, false)).toThrow(
      NotSupportedError,
    );
  });

  test("degrades a NON-unique sparse index to a full index (no throw)", () => {
    expect(project({ sparse: true, unique: false }, false)[0].where).toBeNull();
  });
});
