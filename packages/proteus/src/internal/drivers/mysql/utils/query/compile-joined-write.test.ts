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
// driver in the SAME shape. Pushing `(entity as any)[pk]` raw sent mysql2 a
// BigInt on the child INSERT while the root got the decimal string
// `dehydrateEntity` had already coerced it to — and skipped `transform.to`
// outright.
describe("compileJoinedInsert", () => {
  test("coerces the child PK exactly as the root's copy is coerced", () => {
    const result = compileJoinedInsert(joinedChildEntity, joinedChildMetadata, "app")!;

    const rootValue = result.rootSql.params[columnIndex(result.rootSql.text, "id")];
    const childValue = result.childSql.params[result.childPkParamIndices.get("id")!];

    expect(rootValue).toBe("9007199254740993");
    expect(childValue).toBe(rootValue);
  });

  test("applies the PK's transform.to to the child copy", () => {
    const result = compileJoinedInsert(
      transformedJoinedChildEntity,
      transformedJoinedChildMetadata,
      "app",
    )!;

    const rootValue = result.rootSql.params[columnIndex(result.rootSql.text, "id")];
    const childValue = result.childSql.params[result.childPkParamIndices.get("id")!];

    expect(rootValue).toBe("pk_abc");
    expect(childValue).toBe(rootValue);
  });

  test("compiles a joined insert", () => {
    const result = compileJoinedInsert(joinedChildEntity, joinedChildMetadata, "app")!;

    expect({
      rootSql: result.rootSql,
      childSql: result.childSql,
      childPkParamIndices: [...result.childPkParamIndices],
    }).toMatchSnapshot();
  });
});
