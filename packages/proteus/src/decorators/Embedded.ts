import type { Constructor } from "@lindorm/types";
import { stageEmbedded } from "#internal/entity/metadata/stage-metadata";

export type EmbeddedOptions = {
  prefix?: string;
};

/**
 * Declare a field that embeds an `@Embeddable()` class as flat columns.
 *
 * The embeddable's fields are flattened into the parent table with a
 * configurable column name prefix. Defaults to `${fieldName}_`.
 *
 * ```ts
 * @Embedded(() => Address)
 * homeAddress!: Address | null;
 *
 * @Embedded(() => Address, { prefix: "work_" })
 * workAddress!: Address | null;
 * ```
 */
export const Embedded =
  (embeddableFn: () => Constructor, options?: EmbeddedOptions) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    const key = String(context.name);

    stageEmbedded(context.metadata, {
      key,
      embeddableConstructor: embeddableFn,
      prefix: options?.prefix ?? `${key}_`,
    });
  };
