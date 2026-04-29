import { isObject, isString } from "@lindorm/is";
import { type IScanData, Scanner } from "@lindorm/scanner";
import type { Constructor, Dict } from "@lindorm/types";
import type { EntityScannerInput } from "../../../types/index.js";
import { EntityScannerError } from "../errors/EntityScannerError.js";

export class EntityScanner {
  public static async scan<T extends Dict = Dict>(
    input: EntityScannerInput<T>,
  ): Promise<Array<Constructor<T>>> {
    const entities = input.filter(
      (a) => !isObject(a) && !isString(a) && (a as T).prototype,
    ) as Array<Constructor<T>>;
    const strings = input.filter((a) => isString(a));
    const result: Array<Constructor<T>> = [...entities];
    if (!strings.length) return result;
    for (const path of strings) {
      const item = EntityScanner.scanner.scan(path);
      if (item.isDirectory) {
        result.push(...(await EntityScanner.scanDirectory<T>(item)));
      }
      if (item.isFile) {
        result.push(...(await EntityScanner.scanFile<T>(item)));
      }
    }
    return result;
  }

  // private

  private static async scanDirectory<T extends Dict = Dict>(
    data: IScanData,
  ): Promise<Array<Constructor<T>>> {
    const result: Array<Constructor<T>> = [];
    for (const child of data.children) {
      if (child.isDirectory) {
        result.push(...(await EntityScanner.scanDirectory<T>(child)));
      }
      if (child.isFile) {
        result.push(...(await EntityScanner.scanFile<T>(child)));
      }
    }
    return result;
  }

  private static async scanFile<T extends Dict = Dict>(
    data: IScanData,
  ): Promise<Array<Constructor<T>>> {
    let module: Constructor<T>;
    try {
      module = await EntityScanner.scanner.import<Constructor<T>>(data.fullPath);
    } catch (err) {
      throw new EntityScannerError(
        `Failed to load entity from "${data.fullPath}": ${err instanceof Error ? err.message : String(err)}`,
        {
          error: err instanceof Error ? err : undefined,
          debug: { filePath: data.fullPath },
        },
      );
    }
    const values = Object.values(module);
    if (values.length === 0) {
      throw new EntityScannerError(`No entities found in file: ${data.fullPath}`);
    }
    const result: Array<Constructor<T>> = [];
    for (const value of values) {
      if (value.prototype) {
        result.push(value);
      }
    }
    if (result.length === 0) {
      throw new EntityScannerError(`No entities found in file: ${data.fullPath}`);
    }
    return result;
  }

  private static get scanner(): Scanner {
    return new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }
}
