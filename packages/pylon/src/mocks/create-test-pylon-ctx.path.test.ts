import { join } from "path";
import { describe, expect, test } from "vitest";
import { PathEntity } from "./__fixtures__/PathEntity.js";
import { createTestPylonCtx } from "./vitest.js";

// Proves createTestPylonCtx resolves entities from a directory PATH string — the
// exact form the generated ProteusSource uses (`entities: [join(import.meta.dirname,
// "entities")]`) — and that a class-based repository() call still round-trips
// against the path-scanned registration (i.e. class identity is preserved).
describe("createTestPylonCtx directory-path entity resolution", () => {
  test("registers entities from a dir path and round-trips via the class", async () => {
    const entitiesDir = join(import.meta.dirname, "__fixtures__");

    const ctx = await createTestPylonCtx({ entities: [entitiesDir] });

    const repository = ctx.db!.repository(PathEntity);

    const inserted = await repository.insert({ label: "from-path" });
    expect(inserted.id).toEqual(expect.any(String));
    expect(inserted.label).toBe("from-path");

    const found = await repository.findOne({ id: inserted.id });
    expect(found?.label).toBe("from-path");
  });
});
