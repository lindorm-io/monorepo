import type { IEntity } from "../../../interfaces";
import type { EntityMetadata, MetaEmbeddedList, QueryScope } from "../types/metadata";
import { LazyCollection } from "./lazy-collection";

export type LazyEmbeddedListLoader = (
  entity: IEntity,
  embeddedList: MetaEmbeddedList,
) => Promise<Array<unknown>>;

export type LazyEmbeddedListContext = {
  loadEmbeddedList: LazyEmbeddedListLoader;
};

/**
 * Install lazy `LazyCollection` thenables on entity properties for
 * `@EmbeddedList` fields whose `loading[scope]` is `"lazy"`.
 *
 * Must be called after hydration / eager EL loading. The `defaultCreateEntity`
 * path initialises every EL property to `[]` — that empty array is the
 * "unresolved" marker this helper overwrites. A populated array is assumed
 * to be an eager-loaded result (or a user-provided write) and is preserved.
 */
export const installLazyEmbeddedLists = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  ctx: LazyEmbeddedListContext,
  operationScope: QueryScope,
): void => {
  for (const el of metadata.embeddedLists) {
    if (el.loading[operationScope] !== "lazy") continue;

    const existing = (entity as any)[el.key];

    // Only install the thenable when the property is genuinely unset.
    // Driver hydration leaves the key absent / undefined when
    // loadAllEmbeddedLists skipped this lazy field, which is exactly the
    // unresolved state we want. A concrete Array<T> (empty or populated)
    // was produced by eager loading, user write, or default-create — preserve it.
    if (existing !== undefined) continue;

    (entity as any)[el.key] = new LazyCollection<unknown>(entity, el.key, () =>
      ctx.loadEmbeddedList(entity, el),
    );
  }
};
