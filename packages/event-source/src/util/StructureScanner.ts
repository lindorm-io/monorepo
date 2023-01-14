import { ScanFileData } from "../types";
import { basename, extname, join, relative, sep } from "path";
import { flatten } from "lodash";
import { readdirSync, statSync } from "fs";

export class StructureScanner {
  public readonly directory: string;
  public readonly extensions: Array<string>;

  public constructor(directory: string, extensions: Array<string>) {
    this.directory = directory;
    this.extensions = extensions;
  }

  public scan(): Array<ScanFileData> {
    return this.scanDirectory(this.directory);
  }

  public scanDirectory(directory: string): Array<ScanFileData> {
    const files = readdirSync(directory);
    const array = [];

    for (const file of files) {
      const filePath = join(directory, file);
      const relativePath = relative(this.directory, filePath);
      const stats = statSync(filePath);
      const isTest = file.includes(".spec.") || file.includes(".test.");

      if (stats.isFile() && this.isApprovedExtension(file) && !isTest) {
        const [name, type] = basename(file, extname(file)).split(".");
        array.push({
          name,
          parents: relativePath.split(sep).slice(0, -1).reverse(),
          path: filePath,
          relative: relativePath,
          type,
        });
      } else if (stats.isDirectory()) {
        array.push(this.scanDirectory(filePath));
      }
    }

    return flatten(array);
  }

  private isApprovedExtension(file: string): boolean {
    for (const extension of this.extensions) {
      if (!file.endsWith(extension)) continue;
      return true;
    }
    return false;
  }

  public static hasFiles(directory: string): boolean {
    try {
      const files = readdirSync(directory);
      return files.length > 0;
    } catch (_) {
      return false;
    }
  }
}
