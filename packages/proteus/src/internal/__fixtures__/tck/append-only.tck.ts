// TCK: Append-Only Suite
//
// An @AppendOnly entity is immutable after insert. The four criteria-based
// writes — delete, updateMany, softDelete, restore — must refuse it on EVERY
// driver, with the same append-only error, before any statement reaches the
// store.
//
// This suite exists because that guarantee silently did not hold: the sqlite,
// postgres and mysql repositories each overrode all four public methods without
// calling super, so `guardAppendOnly` never ran on them while memory, mongo and
// redis refused correctly. Nothing caught it, because no case had ever driven
// an append-only entity through a driver.
//
// The assertions are on the error CODE, not merely that something threw. On the
// SQL drivers a bulk write against a populated append-only table is also
// refused by the BEFORE UPDATE/DELETE triggers — so "it threw" would pass while
// the repository guard was missing entirely. The table is left empty (see
// TckAppendOnly) precisely so the database cannot answer for the guard.

import { describe, expect, test } from "vitest";
import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

const APPEND_ONLY_CODE = "append_only_violation";

export const appendOnlySuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  const { TckAppendOnly } = entities;

  describe("appendOnly", () => {
    test("delete refuses an append-only entity", async () => {
      const repo = getHandle().repository(TckAppendOnly);

      await expect(repo.delete({ name: "Anything" })).rejects.toMatchObject({
        code: APPEND_ONLY_CODE,
      });
    });

    test("delete with a limit refuses an append-only entity", async () => {
      const repo = getHandle().repository(TckAppendOnly);

      await expect(repo.delete({ name: "Anything" }, { limit: 1 })).rejects.toMatchObject(
        { code: APPEND_ONLY_CODE },
      );
    });

    test("updateMany refuses an append-only entity", async () => {
      const repo = getHandle().repository(TckAppendOnly);

      await expect(
        repo.updateMany({ name: "Anything" }, { name: "Changed" }),
      ).rejects.toMatchObject({ code: APPEND_ONLY_CODE });
    });

    // An append-only entity cannot carry a @DeleteDateField — metadata build
    // rejects the pair — so these two can never mutate anything either way.
    // What is at stake is WHICH refusal comes back: append-only is the reason
    // there is no delete date, so it must be the answer rather than the
    // downstream "missing @DeleteDateField" complaint about its consequence.
    test("softDelete refuses an append-only entity", async () => {
      const repo = getHandle().repository(TckAppendOnly);

      await expect(repo.softDelete({ name: "Anything" })).rejects.toMatchObject({
        code: APPEND_ONLY_CODE,
      });
    });

    test("restore refuses an append-only entity", async () => {
      const repo = getHandle().repository(TckAppendOnly);

      await expect(repo.restore({ name: "Anything" })).rejects.toMatchObject({
        code: APPEND_ONLY_CODE,
      });
    });

    // The guards the same four methods already carried must survive the move.
    test("updateMany still refuses a versioned entity", async () => {
      const repo = getHandle().repository(entities.TckVersionKeyed);

      await expect(
        repo.updateMany({ name: "Anything" }, { name: "Changed" }),
      ).rejects.toMatchObject({ code: "update_many_not_supported" });
    });

    test("softDelete still refuses an entity with no delete date", async () => {
      const repo = getHandle().repository(entities.TckUnversioned);

      await expect(repo.softDelete({ name: "Anything" })).rejects.toMatchObject({
        code: "missing_delete_date_field",
      });
    });

    test("restore still refuses an entity with no delete date", async () => {
      const repo = getHandle().repository(entities.TckUnversioned);

      await expect(repo.restore({ name: "Anything" })).rejects.toMatchObject({
        code: "missing_delete_date_field",
      });
    });
  });
};
