import { IEntityBase } from "@lindorm/entity";
import { isFunction, isObject, isString } from "@lindorm/is";
import { IScanData, Scanner } from "@lindorm/scanner";
import { Constructor, Dict } from "@lindorm/types";
import { ElasticSourceError } from "../../errors";
import { ElasticSourceEntities, ElasticSourceEntity } from "../../types";

export class EntityScanner {
  // public

  public static scan(array: ElasticSourceEntities): Array<ElasticSourceEntity> {
    const result: Array<ElasticSourceEntity> = [];

    const strings = array.filter((entity) => isString(entity)) as Array<string>;

    const options = array.filter(
      (opts) => isObject(opts) && (opts as ElasticSourceEntity).Entity,
    ) as Array<ElasticSourceEntity>;

    const entities = array
      .filter(
        (opts) =>
          !isObject(opts) &&
          !isString(opts) &&
          (opts as Constructor<IEntityBase>).prototype,
      )
      .map((i) => ({ Entity: i })) as Array<ElasticSourceEntity>;

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

  private static scanDirectory(data: IScanData): Array<ElasticSourceEntity> {
    const result: Array<ElasticSourceEntity> = [];

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

  private static scanFile(data: IScanData): ElasticSourceEntity {
    const module = EntityScanner.scanner.require<Dict>(data.fullPath);
    const entries = Object.entries(module);
    const result: Partial<ElasticSourceEntity> = {};

    if (entries.length === 0) {
      throw new ElasticSourceError(`No entities found in file: ${data.fullPath}`);
    }

    for (const [key, value] of Object.entries(module)) {
      if (key === "default") continue;
      if (
        result.Entity &&
        result.config &&
        result.mappings &&
        result.create &&
        result.validate
      ) {
        break;
      }

      if (key === "config" && isObject(value)) {
        result.config = value;
        continue;
      }

      if (key === "create" && isFunction(value)) {
        result.create = value;
        continue;
      }

      if (key === "mappings" && isObject(value)) {
        result.mappings = value;
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
      throw new ElasticSourceError(`No entities found in file: ${data.fullPath}`);
    }

    return result as ElasticSourceEntity;
  }

  private static get scanner(): Scanner {
    return new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }
}
