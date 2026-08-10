import { isObjectLike, isUndefined } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { ProteusError } from "../../../errors/index.js";

/**
 * Guard against the `order` vs `orderBy` footgun.
 *
 * Offset-based reads (`find`, `findAndCount`, `findPaginated`) sort with
 * `order`; keyset reads (`paginate`, `cursor`) sort with `orderBy`. The names
 * look interchangeable, and passing `orderBy` to an offset read used to be a
 * silent no-op — the sort was dropped and an unsorted result came back with no
 * error. Throw a clear, actionable error instead.
 *
 * An `orderBy` of `undefined` is ABSENT — nothing was specified, so there is
 * no footgun to guard against and a spread options object must not throw.
 */
export const guardFindSortKey = (options: unknown): void => {
  if (isObjectLike(options) && !isUndefined((options as Dict).orderBy)) {
    throw new ProteusError(
      "Invalid option `orderBy` for an offset-based find — use `order`",
      {
        code: "invalid_find_option",
        title: "Invalid Find Option",
        details:
          'find()/findAndCount()/findPaginated() sort with `order` (e.g. { order: { name: "ASC" } }). ' +
          "`orderBy` is only for keyset pagination — paginate() and cursor(). Passing `orderBy` here " +
          "would otherwise be silently ignored and return unsorted results.",
        data: { received: "orderBy", expected: "order" },
      },
    );
  }
};
