import { IEntity } from "@lindorm/entity";
import { isArray, isFunction, isObject, isString } from "@lindorm/is";
import { IScanData, Scanner } from "@lindorm/scanner";
import { Constructor, Dict } from "@lindorm/types";
import { MnemosSourceError } from "../../errors";
import { MnemosSourceEntities, MnemosSourceEntity } from "../../types";

export class EntityScanner {
  // public

  public static scan(array: MnemosSourceEntities): Array<MnemosSourceEntity> {
    const result: Array<MnemosSourceEntity> = [];

    const strings = array.filter((entity) => isString(entity)) as Array<string>;

    const options = array.filter(
      (opts) => isObject(opts) && (opts as MnemosSourceEntity).Entity,
    ) as Array<MnemosSourceEntity>;

    const entities = array
      .filter(
        (opts) =>
          !isObject(opts) && !isString(opts) && (opts as Constructor<IEntity>).prototype,
      )
      .map((i) => ({ Entity: i })) as Array<MnemosSourceEntity>;

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

  private static scanDirectory(data: IScanData): Array<MnemosSourceEntity> {
    const result: Array<MnemosSourceEntity> = [];

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

  private static scanFile(data: IScanData): MnemosSourceEntity {
    const module = EntityScanner.scanner.require<Dict>(data.fullPath);
    const entries = Object.entries(module);
    const result: Partial<MnemosSourceEntity> = {};

    if (entries.length === 0) {
      throw new MnemosSourceError(`No entities found in file: ${data.fullPath}`);
    }

    for (const [key, value] of Object.entries(module)) {
      if (key === "default") continue;
      if (result.Entity && result.create && result.validate) break;

      if (key === "create" && isFunction(value)) {
        result.create = value;
        continue;
      }

      if (key === "constraints" && isArray<any>(value)) {
        result.constraints = value;
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
      throw new MnemosSourceError(`No entities found in file: ${data.fullPath}`);
    }

    return result as MnemosSourceEntity;
  }

  private static get scanner(): Scanner {
    return new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }
}
