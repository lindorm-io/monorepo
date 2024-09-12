import { isFunction, isObject, isString } from "@lindorm/is";
import { ScanData, Scanner } from "@lindorm/scanner";
import { Constructor, Dict } from "@lindorm/types";
import { RedisRepositoryError } from "../../errors";
import { IRedisEntity } from "../../interfaces";
import { RedisSourceEntities, RedisSourceEntity } from "../../types";

export class EntityScanner {
  private readonly scanner: Scanner;

  public constructor() {
    this.scanner = new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }

  // public

  public scan(array: RedisSourceEntities): Array<RedisSourceEntity> {
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
      const item = this.scanner.scan(path);

      if (item.isDirectory) {
        result.push(...this.scanDirectory(item));
      }
      if (item.isFile) {
        result.push(this.scanFile(item));
      }
    }

    return result;
  }

  // private

  private scanDirectory(data: ScanData): Array<RedisSourceEntity> {
    const result: Array<RedisSourceEntity> = [];

    for (const child of data.children) {
      if (child.isDirectory) {
        result.push(...this.scanDirectory(child));
      }
      if (child.isFile) {
        result.push(this.scanFile(child));
      }
    }

    return result;
  }

  private scanFile(data: ScanData): RedisSourceEntity {
    const module = this.scanner.require<Dict>(data.fullPath);
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
}
