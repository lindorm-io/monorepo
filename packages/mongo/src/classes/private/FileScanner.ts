import { isArray, isFunction, isObject, isString } from "@lindorm/is";
import { ScanData, Scanner } from "@lindorm/scanner";
import { Constructor, Dict } from "@lindorm/types";
import { MongoRepositoryError } from "../../errors";
import { IMongoFile } from "../../interfaces";
import { MongoIndexOptions, MongoSourceFile, MongoSourceFiles } from "../../types";

export class FileScanner {
  // public

  public static scan(array: MongoSourceFiles): Array<MongoSourceFile> {
    const result: Array<MongoSourceFile> = [];

    const strings = array.filter((file) => isString(file)) as Array<string>;

    const options = array.filter(
      (opts) => isObject(opts) && (opts as MongoSourceFile).File,
    ) as Array<MongoSourceFile>;

    const files = array
      .filter(
        (opts) =>
          !isObject(opts) &&
          !isString(opts) &&
          (opts as Constructor<IMongoFile>).prototype,
      )
      .map((i) => ({ File: i })) as Array<MongoSourceFile>;

    result.push(...options, ...files);

    if (!strings.length) return result;

    for (const path of strings) {
      const item = FileScanner.scanner.scan(path);

      if (item.isDirectory) {
        result.push(...FileScanner.scanDirectory(item));
      }
      if (item.isFile) {
        result.push(FileScanner.scanFile(item));
      }
    }

    return result;
  }

  // private

  private static scanDirectory(data: ScanData): Array<MongoSourceFile> {
    const result: Array<MongoSourceFile> = [];

    for (const child of data.children) {
      if (child.isDirectory) {
        result.push(...FileScanner.scanDirectory(child));
      }
      if (child.isFile) {
        result.push(FileScanner.scanFile(child));
      }
    }

    return result;
  }

  private static scanFile(data: ScanData): MongoSourceFile {
    const module = FileScanner.scanner.require<Dict>(data.fullPath);
    const entries = Object.entries(module);
    const result: Partial<MongoSourceFile> = {};

    if (entries.length === 0) {
      throw new MongoRepositoryError(`No files found in file: ${data.fullPath}`);
    }

    for (const [key, value] of Object.entries(module)) {
      if (key === "default") continue;
      if (result.File && result.indexes && result.validate) break;

      if (key === "validate" && isFunction(value)) {
        result.validate = value;
        continue;
      }

      if (key === "indexes" && isArray<MongoIndexOptions<any>>(value)) {
        result.indexes = value;
        continue;
      }

      if (value.prototype) {
        result.File = value;
        continue;
      }
    }

    if (!result.File) {
      throw new MongoRepositoryError(`No files found in file: ${data.fullPath}`);
    }

    return result as MongoSourceFile;
  }

  private static get scanner(): Scanner {
    return new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }
}
