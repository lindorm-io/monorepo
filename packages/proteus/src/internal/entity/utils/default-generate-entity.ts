import { lindormId } from "@lindorm/random";
import type { Constructor, DeepPartial } from "@lindorm/types";
import { randomBytes, randomInt, randomUUID } from "crypto";
import type { IEntity } from "../../../interfaces/index.js";
import { EntityManagerError } from "../errors/EntityManagerError.js";
import { getEntityMetadata } from "../metadata/get-entity-metadata.js";
import type { MetaGenerated, MetaGeneratedStrategy } from "../types/metadata.js";

export const generateValue = (config: MetaGenerated): any => {
  if (config.generator) {
    return config.generator();
  }

  switch (config.strategy) {
    case "date":
      return new Date();

    case "float": {
      const min = config.min ?? 0;
      const max = config.max ?? 999999;
      return Math.random() * (max - min) + min;
    }

    case "identity":
    case "increment":
      return null;

    case "integer": {
      const min = config.min ?? 0;
      const max = config.max ?? 999999;
      return randomInt(min, max);
    }

    case "lindorm_id":
      return lindormId({
        namespace: config.namespace ?? undefined,
        length: (config.length ?? 24) as 24,
      });

    case "string": {
      const length = config.length ?? 32;
      return randomBytes(length).toString("base64url");
    }

    case "uuid":
      return randomUUID();

    default:
      return null;
  }
};

/**
 * The single source of truth for which @Generated strategies are computed
 * entirely app-side — no DB round-trip — so `create()` can populate them
 * immediately (the sign-then-persist pattern mints a token carrying the id,
 * THEN inserts the row, so the id must exist before the write).
 *
 * The remaining strategies are deferred to `insert()`:
 *   - `date`               : persist-time — createdAt = when the row is WRITTEN,
 *                            not when the entity is constructed.
 *   - `increment` / `identity` : DB-assigned — cannot exist before the row.
 *   - `float` / `integer`  : client-side generatable, but not part of the
 *                            identity contract — left at insert by default.
 */
export const CLIENT_SIDE_CREATE_STRATEGIES: ReadonlyArray<MetaGeneratedStrategy> = [
  "lindorm_id",
  "string",
  "uuid",
];

export const isClientSideCreateStrategy = (
  strategy: MetaGeneratedStrategy | null,
): boolean => strategy != null && CLIENT_SIDE_CREATE_STRATEGIES.includes(strategy);

/**
 * Populate the client-side IDENTITY fields (lindorm_id / uuid / string) that are
 * still null, at `create()`/`copy()`/`clone()` time — so `entity.id` is available
 * on return without a DB round-trip. Idempotent: a caller-supplied or
 * already-generated value is preserved, so `insert()`'s `generate()` never
 * double-generates a create-time id. A `@Generated` config with a custom
 * `generator` is left to `generate()` at insert (its strategy is null, so it is
 * not classified as a client-side identity strategy here).
 */
export const generateCreateEntity = <E extends IEntity>(
  target: Constructor<E>,
  entity: DeepPartial<E>,
): E => {
  const metadata = getEntityMetadata(target);
  for (const config of metadata.generated) {
    if (entity[config.key] != null) continue;
    if (!isClientSideCreateStrategy(config.strategy)) continue;
    (entity as any)[config.key] = generateValue(config);
  }
  return entity as E;
};

export const defaultGenerateEntity = <E extends IEntity>(
  target: Constructor<E>,
  entity: DeepPartial<E>,
): E => {
  const metadata = getEntityMetadata(target);
  for (const config of metadata.generated) {
    if (entity[config.key] != null) continue;
    if (config.strategy === "increment" || config.strategy === "identity") continue;
    (entity as any)[config.key] = generateValue(config);
  }

  // A primary key with no value AND no generator cannot be satisfied — natural keys
  // must be provided explicitly, generated keys must declare a @Generated strategy.
  // (increment/identity generators legitimately leave the value null here; the DB
  // assigns it on insert, so the presence of any generator passes this guard.)
  for (const key of metadata.primaryKeys) {
    if (entity[key as keyof DeepPartial<E>] != null) continue;
    if (metadata.generated.some((g) => g.key === key)) continue;

    throw new EntityManagerError("Missing primary key value", {
      code: "missing_primary_key_value",
      title: "Missing Primary Key Value",
      details: `Primary key "${key}" on "${metadata.entity.name}" has no value and no generator — add a @Generated(...) to generate it or provide the value explicitly.`,
      debug: { entity: metadata.entity.name, primaryKey: key },
    });
  }

  return entity as E;
};
