import { EntityMetadataError } from "../errors/EntityMetadataError";
import type { MetaEmbeddedList } from "../types/metadata";

/**
 * Reject TypeScript class field initializers on `@EmbeddedList` fields whose
 * loading scope is `"lazy"` in either `single` or `multiple`.
 *
 * Why: `installLazyEmbeddedLists` only installs a `LazyCollection` thenable
 * when the property is `undefined` after hydrate. A field initializer like
 * `public tags: string[] = []` runs inside `new target()` before hydrate,
 * leaving `tags = []` — the install helper then skips the field and the
 * lazy loader is never attached. The user awaits the field and gets an
 * empty array forever, silently wrong.
 *
 * Declare `@EmbeddedList` fields with the definite-assignment assertion
 * (`public tags!: Array<T>`) so no initializer is emitted. Eager-only
 * fields are unaffected — only lazy scopes trigger the check.
 */
export const validateEmbeddedListInitializers = (
  targetName: string,
  target: Function,
  embeddedLists: Array<MetaEmbeddedList>,
): void => {
  const lazyKeys = embeddedLists
    .filter((el) => el.loading.single === "lazy" || el.loading.multiple === "lazy")
    .map((el) => el.key);

  if (lazyKeys.length === 0) return;

  let probe: any;
  try {
    probe = new (target as new () => unknown)();
  } catch {
    // Entity classes are expected to be zero-arg constructible; if the
    // probe throws, skip the check rather than masking the underlying error.
    return;
  }

  for (const key of lazyKeys) {
    if (!Object.prototype.hasOwnProperty.call(probe, key)) continue;
    const value = probe[key];
    if (value === undefined) continue;

    throw new EntityMetadataError(
      `@EmbeddedList property "${key}" on "${targetName}" carries a runtime field initializer but resolves to a lazy loading scope — initializers are incompatible with lazy loading. Declare the field with the definite-assignment assertion instead: "${key}!: Array<T>".`,
      { debug: { target: targetName, property: key } },
    );
  }
};
