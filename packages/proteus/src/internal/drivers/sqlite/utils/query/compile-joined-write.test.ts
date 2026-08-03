import { describe, expect, test, vi } from "vitest";
import {
  JoinedRoot,
  TransformedJoinedRoot,
  joinedChildEntity,
  joinedChildMetadata,
  joinedRootMetadata,
  transformedJoinedChildEntity,
  transformedJoinedChildMetadata,
  transformedJoinedRootMetadata,
} from "../../../../__fixtures__/joined-metadata.js";
import { compileJoinedInsert } from "./compile-joined-write.js";

vi.mock("../../../../entity/metadata/get-entity-metadata.js", () => ({
  getEntityMetadata: vi.fn((ctor: any) => {
    if (ctor === JoinedRoot) return joinedRootMetadata;
    if (ctor === TransformedJoinedRoot) return transformedJoinedRootMetadata;
    throw new Error(`Unknown entity: ${ctor?.name}`);
  }),
}));

/** The parameter index of a column in a compiled `INSERT (cols) VALUES (…)`. */
const columnIndex = (text: string, column: string): number =>
  text
    .slice(text.indexOf("(") + 1, text.indexOf(")"))
    .split(",")
    .findIndex((col) => col.trim().replace(/["`]/g, "") === column);

// The child row's PK is the SAME value as the root row's, so it must reach the
// driver in the SAME shape. Pushing `(entity as any)[pk]` raw skipped the root's
// whole write pipeline for the child copy.
//
// There is no bigint assertion here on purpose: SQLite binds a bigint natively,
// so `coerceWriteValue` is the identity for every type a PK may legally have —
// a bigint test would pass with the raw push too and prove nothing. The
// `transform.to` half runs before any driver coercion, so it does bite here.
describe("compileJoinedInsert", () => {
  test("applies the PK's transform.to to the child copy", () => {
    const result = compileJoinedInsert(
      transformedJoinedChildEntity,
      transformedJoinedChildMetadata,
    )!;

    const rootValue = result.rootSql.params[columnIndex(result.rootSql.text, "id")];
    const childValue = result.childSql.params[result.childPkParamIndices.get("id")!];

    expect(rootValue).toBe("pk_abc");
    expect(childValue).toBe(rootValue);
  });

  test("compiles a joined insert", () => {
    const result = compileJoinedInsert(joinedChildEntity, joinedChildMetadata)!;

    expect({
      rootSql: result.rootSql,
      childSql: result.childSql,
      childPkParamIndices: [...result.childPkParamIndices],
    }).toMatchSnapshot();
  });
});
