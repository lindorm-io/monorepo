import type { Dict } from "@lindorm/types";
import { stageJoinField } from "../internal/entity/metadata/stage-metadata";

/**
 * Mark this relation field as the owning side (has FK column) and optionally
 * provide an explicit join key mapping.
 *
 * - `@JoinKey()` — this side owns the FK; column names are auto-calculated.
 * - `@JoinKey({ authorId: "id" })` — explicit mapping `{ localCol: foreignCol }`.
 *
 * Replaces `hasJoinKey: true` and `joinKeys: { ... }` on relation decorators.
 */
export const JoinKey =
  (mapping?: Dict<string>) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    const key = String(context.name);

    stageJoinField(context.metadata, {
      key,
      joinKeys: mapping ?? true,
    });
  };
