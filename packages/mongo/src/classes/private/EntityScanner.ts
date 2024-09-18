import { isArray, isFunction, isObject, isString } from "@lindorm/is";
import { ScanData, Scanner } from "@lindorm/scanner";
import { Constructor, Dict } from "@lindorm/types";
import { MongoRepositoryError } from "../../errors";
import { IMongoEntity } from "../../interfaces";
import { MongoIndexOptions, MongoSourceEntities, MongoSourceEntity } from "../../types";

export class EntityScanner {
  private readonly scanner: Scanner;

  public constructor() {
    this.scanner = new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }

  // public

  public scan(array: MongoSourceEntities): Array<MongoSourceEntity> {
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

  private scanDirectory(data: ScanData): Array<MongoSourceEntity> {
    const result: Array<MongoSourceEntity> = [];

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

  private scanFile(data: ScanData): MongoSourceEntity {
    const module = this.scanner.require<Dict>(data.fullPath);
    const entries = Object.entries(module);
    const result: Partial<MongoSourceEntity> = {};

    if (entries.length === 0) {
      throw new MongoRepositoryError(`No entities found in file: ${data.fullPath}`);
    }

    for (const [key, value] of Object.entries(module)) {
      if (key === "default") continue;
      if (result.Entity && result.validate) break;

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
}
