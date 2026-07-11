import { describe, expect, test } from "vitest";
import { Entity } from "../../../../decorators/Entity.js";
import { Generated } from "../../../../decorators/Generated.js";
import { PrimaryKeyField } from "../../../../decorators/PrimaryKeyField.js";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";
import { applyNamingStrategy } from "../../../utils/naming/apply-naming-strategy.js";
import { buildEntityKey } from "./build-entity-key.js";
import { buildIncrementKey } from "./build-increment-key.js";
import { buildScanPattern } from "./build-scan-pattern.js";

// Real getEntityName (no mock) so the composed keys reflect the naming strategy.

@Entity()
class RedisNamingRefreshTokenChain {
  @PrimaryKeyField() @Generated("uuid") id!: string;
}

@Entity({ name: "custom_chain" })
class RedisNamingCustomChain {
  @PrimaryKeyField() @Generated("uuid") id!: string;
}

const snake = (target: Function) =>
  applyNamingStrategy(getEntityMetadata(target), "snake");

describe("redis key builders follow the naming strategy", () => {
  test("buildEntityKey uses the snake_cased table name for a bare @Entity()", () => {
    const key = buildEntityKey(snake(RedisNamingRefreshTokenChain), ["id-1"], null);
    expect(key).toBe("entity:redis_naming_refresh_token_chain:id-1");
  });

  test("buildScanPattern uses the snake_cased table name", () => {
    const pattern = buildScanPattern(snake(RedisNamingRefreshTokenChain), null);
    expect(pattern).toBe("entity:redis_naming_refresh_token_chain:*");
  });

  test("buildIncrementKey uses the snake_cased table name", () => {
    const key = buildIncrementKey(snake(RedisNamingRefreshTokenChain), "id", null);
    expect(key).toBe("seq:redis_naming_refresh_token_chain:id");
  });

  test("@Entity({ name }) stays verbatim under 'snake'", () => {
    const key = buildEntityKey(snake(RedisNamingCustomChain), ["id-1"], null);
    expect(key).toBe("entity:custom_chain:id-1");
  });
});
