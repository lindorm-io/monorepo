import { isArray, isFunction, isObject, isString } from "@lindorm/is";
import { IScanData, Scanner } from "@lindorm/scanner";
import { Constructor, Dict } from "@lindorm/types";
import { MongoRepositoryError } from "../../errors";
import { IMongoEntity } from "../../interfaces";
import { MongoIndexOptions, MongoSourceEntities, MongoSourceEntity } from "../../types";

export class EntityScanner {
  // public

  public static scan(array: MongoSourceEntities): Array<MongoSourceEntity> {
    const result: Array<MongoSourceEntity> = [];

    const strings = array.filter((entity) => isString(entity)) as Array<string>;

    const options = array.filter(
      (opts) => isObject(opts) && (opts as MongoSourceEntity).Entity,
    ) as Array<MongoSourceEntity>;

    const entities = array
      .filter(
        (opts) =>
          !isObject(opts) &&
          !isString(opts) &&
          (opts as Constructor<IMongoEntity>).prototype,
      )
      .map((i) => ({ Entity: i })) as Array<MongoSourceEntity>;

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

  private static scanDirectory(data: IScanData): Array<MongoSourceEntity> {
    const result: Array<MongoSourceEntity> = [];

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

  private static scanFile(data: IScanData): MongoSourceEntity {
    const module = EntityScanner.scanner.require<Dict>(data.fullPath);
    const entries = Object.entries(module);
    const result: Partial<MongoSourceEntity> = {};

    if (entries.length === 0) {
      throw new MongoRepositoryError(`No entities found in file: ${data.fullPath}`);
    }

    for (const [key, value] of Object.entries(module)) {
      if (key === "default") continue;
      if (result.Entity && result.config && result.indexes && result.validate) break;

      if (key === "config" && isObject(value)) {
        result.config = value;
        continue;
      }

      if (key === "indexes" && isArray<MongoIndexOptions<any>>(value)) {
        result.indexes = value;
        continue;
      }

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
      throw new MongoRepositoryError(`No entities found in file: ${data.fullPath}`);
    }

    return result as MongoSourceEntity;
  }

  private static get scanner(): Scanner {
    return new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }
}
