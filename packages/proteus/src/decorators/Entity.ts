import type { EntityDecoratorOptions } from "#internal/entity/types/decorators";
import { registerEntity } from "#internal/entity/metadata/registry";
import { stageEntity } from "#internal/entity/metadata/stage-metadata";

/**
 * Mark a class as a Proteus entity.
 *
 * - `@Entity()` — use the class name as the entity name
 * - `@Entity({ name: "custom" })` — override the entity name
 */
export const Entity =
  (options: EntityDecoratorOptions = {}) =>
  (target: Function, context: ClassDecoratorContext): void => {
    const name = options.name ?? target.name;

    if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error(
        `Invalid entity name "${name}": must match /^[a-zA-Z_][a-zA-Z0-9_]*$/`,
      );
    }

    stageEntity(context.metadata, {
      decorator: "Entity",
      comment: null,
      name,
      namespace: null,
    });

    registerEntity(name, target);
  };
