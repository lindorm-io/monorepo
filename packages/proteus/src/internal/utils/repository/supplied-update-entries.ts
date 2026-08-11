import { isUndefined } from "@lindorm/is";
import type { DeepPartial } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";

/**
 * The fields an update payload actually SUPPLIED.
 *
 * `undefined` means "the key was not supplied" at every input boundary, so an
 * undefined value leaves the column ALONE — it is not in the update set at all.
 * Every driver used to write `null` for it, so a spread-built partial update
 * silently nulled every field the caller had not set, and on a NOT NULL column
 * it failed the whole statement (reproduced on sqlite and the memory driver).
 *
 * `null` is a real value and stays in the set: it is how a column is explicitly
 * cleared.
 */
export const suppliedUpdateEntries = <E extends IEntity>(
  update: DeepPartial<E>,
): Array<[string, unknown]> =>
  Object.entries(update as Record<string, unknown>).filter(
    ([, value]) => !isUndefined(value),
  );
