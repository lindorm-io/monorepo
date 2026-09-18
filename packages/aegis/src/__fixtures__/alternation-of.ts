/** Every character with meaning in a regexp, so a name carrying one binds literally. */
const SPECIAL = /[.*+?^${}()|[\]\\]/g;

/**
 * A regexp admitting exactly the names given, each escaped — so a parameter
 * type derived from a registry list binds a member and nothing else, whatever
 * characters a name carries.
 *
 * Escapes by hand rather than through `RegExp.escape`: the engines floor is
 * `>=24.13.0` and CI runs 25.x, so nothing here exercises the floor.
 */
export const alternationOf = (names: ReadonlyArray<string>): RegExp =>
  new RegExp(names.map((name) => name.replace(SPECIAL, "\\$&")).join("|"));
