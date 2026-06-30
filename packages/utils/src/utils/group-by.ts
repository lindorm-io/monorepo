/**
 * Group items by a selector key, preserving insertion order of both the keys
 * and the items within each group.
 *
 * @example
 * groupBy([{ t: "a", n: 1 }, { t: "b", n: 2 }, { t: "a", n: 3 }], (i) => i.t);
 * // Map { "a" => [{t:"a",n:1}, {t:"a",n:3}], "b" => [{t:"b",n:2}] }
 */
export const groupBy = <T, K>(
  items: Iterable<T>,
  key: (item: T) => K,
): Map<K, Array<T>> => {
  const groups = new Map<K, Array<T>>();

  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) {
      group.push(item);
    } else {
      groups.set(k, [item]);
    }
  }

  return groups;
};

/**
 * Index items by a selector key, keeping a single item per key (last one wins).
 * The companion to `groupBy` when keys are unique.
 *
 * @example
 * keyBy([{ id: "a" }, { id: "b" }], (i) => i.id);
 * // Map { "a" => {id:"a"}, "b" => {id:"b"} }
 */
export const keyBy = <T, K>(items: Iterable<T>, key: (item: T) => K): Map<K, T> => {
  const map = new Map<K, T>();

  for (const item of items) {
    map.set(key(item), item);
  }

  return map;
};
