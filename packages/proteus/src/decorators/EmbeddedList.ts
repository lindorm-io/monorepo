import type { Constructor } from "@lindorm/types";
import type { MetaFieldType } from "../internal/entity/types/metadata";
import { stageEmbeddedList } from "../internal/entity/metadata/stage-metadata";

export type EmbeddedListOptions = {
  tableName?: string;
};

/**
 * Declare a field that stores an array of primitives or embeddables
 * in a separate owned collection table.
 *
 * The collection table has no PK and no independent lifecycle — it is
 * fully parent-owned. Deleting the parent cascades to collection rows.
 *
 * ```ts
 * // Embeddable array:
 * @EmbeddedList(() => Address)
 * addresses!: Address[];
 *
 * // Primitive array:
 * @EmbeddedList("string")
 * tags!: string[];
 *
 * // With custom table name:
 * @EmbeddedList("string", { tableName: "user_tags" })
 * tags!: string[];
 * ```
 */
export const EmbeddedList =
  (typeOrFn: MetaFieldType | (() => Constructor), options?: EmbeddedListOptions) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    const key = String(context.name);
    const isConstructorFn = typeof typeOrFn === "function";

    stageEmbeddedList(context.metadata, {
      key,
      elementConstructor: isConstructorFn ? (typeOrFn as () => Constructor) : null,
      elementType: isConstructorFn ? null : typeOrFn,
      tableName: options?.tableName ?? null,
    });
  };
