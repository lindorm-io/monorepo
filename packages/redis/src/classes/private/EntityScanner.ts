import { isFunction, isObject, isString } from "@lindorm/is";
import { IScanData, Scanner } from "@lindorm/scanner";
import { Constructor, Dict } from "@lindorm/types";
import { RedisRepositoryError } from "../../errors";
import { IRedisEntity } from "../../interfaces";
import { RedisSourceEntities, RedisSourceEntity } from "../../types";

export class EntityScanner {
  // public

  public static scan(array: RedisSourceEntities): Array<RedisSourceEntity> {
    const result: Array<RedisSourceEntity> = [];

    const strings = array.filter((entity) => isString(entity)) as Array<string>;

    const options = array.filter(
      (opts) => isObject(opts) && (opts as RedisSourceEntity).Entity,
    ) as Array<RedisSourceEntity>;

    const entities = array
      .filter(
        (opts) =>
          !isObject(opts) &&
          !isString(opts) &&
          (opts as Constructor<IRedisEntity>).prototype,
      )
      .map((i) => ({ Entity: i })) as Array<RedisSourceEntity>;

    result.push(...options, ...entities);

    if (!strings.length) return result;

    for (const path of strings) {
      const item = EntityScanner.scanner.scan(path);

      if (item.isDirectory) {
        result.push(...EntityScanner.scanDirectory(item));
      }
      if (item.isFile) {
        result.push(EntityScanner.scanFile(item));
      }
    }

    return result;
  }

  // private

  private static scanDirectory(data: IScanData): Array<RedisSourceEntity> {
    const result: Array<RedisSourceEntity> = [];

    for (const child of data.children) {
      if (child.isDirectory) {
        result.push(...EntityScanner.scanDirectory(child));
      }
      if (child.isFile) {
        result.push(EntityScanner.scanFile(child));
      }
    }

    return result;
  }

  private static scanFile(data: IScanData): RedisSourceEntity {
    const module = EntityScanner.scanner.require<Dict>(data.fullPath);
    const entries = Object.entries(module);
    const result: Partial<RedisSourceEntity> = {};

    if (entries.length === 0) {
      throw new RedisRepositoryError(`No entities found in file: ${data.fullPath}`);
    }

    for (const [key, value] of Object.entries(module)) {
      if (key === "default") continue;
      if (result.Entity && result.validate) break;

      if (key === "validate" && isFunction(value)) {
        result.validate = value;
        continue;
      }

      if (value.prototype) {
        result.Entity = value;
        continue;
      }
    }

    if (!result.Entity) {
      throw new RedisRepositoryError(`No entities found in file: ${data.fullPath}`);
    }

    return result as RedisSourceEntity;
  }

  private static get scanner(): Scanner {
    return new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }
}
