import { isString } from "@lindorm/is";
import { ScanData, Scanner } from "@lindorm/scanner";
import { Constructor, Dict } from "@lindorm/types";
import { RedisError } from "../../errors";
import { IRedisEntity } from "../../interfaces";

type Result = Constructor<IRedisEntity>;

export class EntityScanner {
  private readonly scanner: Scanner;

  public constructor() {
    this.scanner = new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }

  // public

  public scan(array: Array<Constructor<IRedisEntity> | string>): Array<Result> {
    const result: Array<Constructor<IRedisEntity>> = [];

    const entities = array.filter((entity) => !isString(entity)) as Array<
      Constructor<IRedisEntity>
    >;

    result.push(...entities);

    const strings = array.filter((entity) => isString(entity)) as Array<string>;

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

  private scanDirectory(data: ScanData): Array<Constructor<IRedisEntity>> {
    const result: Array<Constructor<IRedisEntity>> = [];

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

  private scanFile(data: ScanData): Constructor<IRedisEntity> {
    const module = this.scanner.require<Dict>(data.fullPath);
    const values = Object.values(module);

    if (values.length === 0) {
      throw new RedisError(`No entities found in file: ${data.fullPath}`);
    }

    if (values.length === 1 && values.includes("default")) {
      throw new RedisError(`No default export allowed for class: ${data.fullPath}`);
    }

    for (const value of values) {
      if (value.default) continue;

      return value as Constructor<IRedisEntity>;
    }

    throw new RedisError(`No entities found in file: ${data.fullPath}`);
  }
}
