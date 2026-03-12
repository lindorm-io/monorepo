import { stageDiscriminator } from "#internal/entity/metadata/stage-metadata";

/**
 * Point to which property serves as the discriminator column for table inheritance.
 *
 * The field name is compile-time checked against the decorated class — a
 * type error is raised if the property does not exist.
 *
 * - `@Discriminator("type")` — use the "type" property as discriminator
 */
export const Discriminator =
  <K extends string>(fieldName: K) =>
  <T extends Record<K, unknown>>(
    _target: abstract new (...args: any[]) => T,
    context: ClassDecoratorContext,
  ): void => {
    stageDiscriminator(context.metadata, fieldName);
  };
