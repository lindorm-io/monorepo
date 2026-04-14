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
 * Module-scoped invocation counter for lazy-EL loaders. Incremented once per
 * actual driver loader call (inside the deferred closure `LazyCollection`
 * invokes on first await). Used by the TCK suite to prove deferred loading
 * is genuine — i.e. that no load happened before the user awaited — and to
 * assert that double-await is cached.
 *
 * This is test-only instrumentation; the cost is a single integer increment
 * per lazy-EL resolution and is intentionally always-on to avoid test harness
 * plumbing. Do not build production logic on it.
 */
let lazyEmbeddedListLoaderInvocations = 0;

export const getLazyEmbeddedListLoaderInvocations = (): number =>
  lazyEmbeddedListLoaderInvocations;

export const resetLazyEmbeddedListLoaderInvocations = (): void => {
  lazyEmbeddedListLoaderInvocations = 0;
};

/**
 * Install lazy `LazyCollection` thenables on entity properties for
 * `@EmbeddedList` fields whose `loading[scope]` is `"lazy"`.
 *
 * Must be called after hydration / eager EL loading. A field is treated as
 * "unresolved" only when its value is `undefined` — i.e. driver hydrate skipped
 * it because the scope is lazy. Any defined value (empty array, populated
 * array, user write) is preserved as-is.
 *
 * Because a TS class field initializer (`public tags: string[] = []`) would
 * leave the property defined before hydrate and silently suppress the lazy
 * install, `buildPrimaryMetadata` rejects such initializers at build time via
 * `validateEmbeddedListInitializers`. Declare lazy `@EmbeddedList` fields with
 * the definite-assignment assertion (`public tags!: Array<T>`).
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

    (entity as any)[el.key] = new LazyCollection<unknown>(entity, el.key, () => {
      lazyEmbeddedListLoaderInvocations += 1;
      return ctx.loadEmbeddedList(entity, el);
    });
  }
};
