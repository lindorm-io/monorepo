import type { DiscriminatorValue } from "../types/inheritance.js";
import { EntityMetadataError } from "../errors/EntityMetadataError.js";
import { collectOwn, collectSingular } from "./collect.js";

/**
 * Validate that @Discriminator is accompanied by @Inheritance on the same class.
 * Throws if @Discriminator is present without @Inheritance on the same class.
 */
export const validateDiscriminatorRequiresInheritance = (target: Function): void => {
  const discriminator = collectOwn(target, "__discriminator");
  const inheritance = collectOwn(target, "__inheritance");

  if (discriminator && !inheritance) {
    throw new EntityMetadataError(
      `@Discriminator requires @Inheritance on the same class "${target.name}"`,
      { debug: { target: target.name } },
    );
  }
};

/**
 * Validate that @Inheritance is accompanied by @Discriminator on the same class.
 * Throws if @Inheritance is present without @Discriminator.
 */
export const validateInheritanceRequiresDiscriminator = (target: Function): void => {
  const inheritance = collectOwn(target, "__inheritance");
  const discriminator = collectOwn(target, "__discriminator");

  if (inheritance && !discriminator) {
    throw new EntityMetadataError(
      `@Inheritance on "${target.name}" requires @Discriminator to specify the discriminator field`,
      { debug: { target: target.name } },
    );
  }
};

/**
 * Validate that @DiscriminatorValue is not placed on the root entity itself.
 * The root entity defines the hierarchy — it does not have a discriminator value.
 */
export const validateDiscriminatorValueNotOnRoot = (target: Function): void => {
  const inheritance = collectOwn(target, "__inheritance");
  const discriminatorValue = collectOwn(target, "__discriminatorValue");

  if (inheritance && discriminatorValue !== undefined) {
    throw new EntityMetadataError(
      `@DiscriminatorValue cannot be applied to inheritance root "${target.name}" — only subtypes may have a discriminator value`,
      { debug: { target: target.name } },
    );
  }
};

/**
 * Validate that @DiscriminatorValue is only used on entities that are part of an
 * inheritance hierarchy (i.e., @Inheritance exists somewhere in the prototype chain).
 */
export const validateDiscriminatorValueRequiresHierarchy = (target: Function): void => {
  const discriminatorValue = collectOwn(target, "__discriminatorValue");
  if (discriminatorValue === undefined) return;

  // Check if @Inheritance exists anywhere in the metadata chain (inherited)
  const inheritance = collectSingular(target, "__inheritance");
  if (!inheritance) {
    throw new EntityMetadataError(
      `@DiscriminatorValue on "${target.name}" requires @Inheritance in the class hierarchy`,
      { debug: { target: target.name } },
    );
  }
};

/**
 * Validate that discriminator values are unique within a hierarchy.
 * Takes a map of discriminator value to constructor and the root name for error messages.
 */
export const validateUniqueDiscriminatorValues = (
  rootName: string,
  children: Map<DiscriminatorValue, Function>,
  newValue: DiscriminatorValue,
  newTarget: Function,
): void => {
  const existing = children.get(newValue);
  if (existing) {
    throw new EntityMetadataError(
      `Discriminator value "${String(newValue)}" is already used by entity "${existing.name}" in the "${rootName}" hierarchy`,
      {
        debug: {
          root: rootName,
          value: newValue,
          existing: existing.name,
          duplicate: newTarget.name,
        },
      },
    );
  }
};

/**
 * Validate that a non-abstract subtype has @DiscriminatorValue.
 */
export const validateSubtypeHasDiscriminatorValue = (
  rootName: string,
  target: Function,
): void => {
  const isAbstract = collectOwn(target, "__abstract");
  if (isAbstract) return; // Abstract subtypes don't need a value

  const discriminatorValue = collectOwn(target, "__discriminatorValue");
  if (discriminatorValue === undefined) {
    throw new EntityMetadataError(
      `Entity "${target.name}" extends inheritance root "${rootName}" but is missing @DiscriminatorValue`,
      { debug: { root: rootName, target: target.name } },
    );
  }
};

/**
 * Validate that joined strategy does not allow depth > 1 (no multi-level joined inheritance).
 * All subtypes must be direct children of the root.
 *
 * Chain walk explanation:
 * - `Object.getPrototypeOf(target)` returns the parent constructor (not prototype object).
 *   For `class Car extends Vehicle`, `Object.getPrototypeOf(Car) === Vehicle`.
 * - We walk constructors upward, stopping when we reach the root.
 * - For each intermediate constructor, we check `Symbol.metadata` (TC39 Stage 3):
 *   Each decorated class gets its own metadata object (prototypally inheriting from parent's).
 *   `Object.hasOwn` ensures we only count classes with their OWN `@Entity`/`@AbstractEntity`
 *   decorators, not inherited metadata.
 * - Non-annotated intermediate classes (plain JS classes without decorators) are transparent:
 *   they have no own `entity`/`__abstract` in their metadata, so they don't increment depth.
 */
export const validateJoinedDepth = (
  rootName: string,
  root: Function,
  target: Function,
): void => {
  // Walk the constructor chain from target toward root, counting annotated entity levels
  let current = Object.getPrototypeOf(target);
  let depth = 0;

  while (current && current !== Object.prototype) {
    // Reached the root — stop counting
    if (current === root) break;

    // Check if this intermediate class is a registered entity or abstract entity.
    // Symbol.metadata is an own property on decorated constructors (TC39 Stage 3).
    // Object.hasOwn guards against counting inherited metadata from ancestor classes.
    const meta = current[Symbol.metadata];
    if (meta && (Object.hasOwn(meta, "entity") || Object.hasOwn(meta, "__abstract"))) {
      depth++;
    }
    current = Object.getPrototypeOf(current);
  }

  if (depth > 0) {
    throw new EntityMetadataError(
      `Joined inheritance in the "${rootName}" hierarchy does not support multi-level depth — "${target.name}" must directly extend the root`,
      { debug: { root: rootName, target: target.name, depth: depth + 1 } },
    );
  }
};
