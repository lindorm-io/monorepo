import { isString } from "@lindorm/is";
import { readdirSync, statSync } from "fs";
import { basename, extname, join, relative, sep } from "path";
import { IScanner, ScanData, StructureScannerOptions } from "../types";

export class Scanner implements IScanner {
  private readonly deniedDirectories: Array<RegExp>;
  private readonly deniedExtensions: Array<RegExp>;
  private readonly deniedFilenames: Array<RegExp>;
  private readonly deniedTypes: Array<RegExp>;
  private readonly parentDirection: "default" | "reverse";
  private readonly requireFn: NodeJS.Require;

  public constructor(options: Partial<StructureScannerOptions> = {}) {
    this.deniedDirectories = options.deniedDirectories || [];
    this.deniedExtensions = options.deniedExtensions || [];
    this.deniedFilenames = options.deniedFilenames || [];
    this.deniedTypes = options.deniedTypes || [];
    this.parentDirection = options.parentDirection || "default";

    this.requireFn = options.requireFn || require;
  }

  // public

  public scan(...paths: Array<string>): Array<ScanData> {
    return this.performScan(join(...paths));
  }

  public async import<T>(fileOrPath: ScanData | string): Promise<T> {
    return await import(isString(fileOrPath) ? fileOrPath : fileOrPath.fullPath);
  }

  public require<T>(fileOrPath: ScanData | string): T {
    return this.requireFn(isString(fileOrPath) ? fileOrPath : fileOrPath.fullPath);
  }

  // public static

  public static flatten(array: Array<ScanData>): Array<ScanData> {
    const result: Array<ScanData | Array<ScanData>> = [];

    for (const item of array) {
      if (item.isDirectory) {
        result.push(Scanner.flatten(item.children));
      }

      if (item.isFile) {
        result.push(item);
      }
    }

    return result.flat();
  }

  public static hasFiles(directory: string): boolean {
    try {
      return readdirSync(directory).length > 0;
    } catch (_) {
      return false;
    }
  }

  // private

  private performScan(path: string, root?: string): Array<ScanData> {
    const rootDir = root ?? path;
    const items = readdirSync(path);
    const result: Array<ScanData> = [];

    for (const item of items) {
      const fullPath = join(path, item);
      const fullName = basename(fullPath);
      const relativePath = relative(rootDir, fullPath);
      const stats = statSync(fullPath);

      const isDirectory = stats.isDirectory();
      const isFile = stats.isFile();

      const relativeParents = relativePath.split(sep).slice(0, -1);
      const parents =
        this.parentDirection === "default" ? relativeParents : relativeParents.reverse();

      if (isDirectory) {
        if (!this.isAllowedDirectoryBaseName(fullName)) continue;

        result.push({
          baseName: fullName,
          basePath: relativePath,
          children: this.performScan(fullPath, rootDir),
          extension: null,
          fullName,
          fullPath,
          isDirectory,
          isFile,
          parents,
          relativePath,
          types: [],
        });

        continue;
      }

      if (isFile) {
        const ext = extname(item);
        const [_, extension] = ext.split(".");
        const nameArray = basename(item, ext).split(".");
        const baseName = nameArray[0];
        const types = nameArray.length > 1 ? nameArray.reverse().slice(0, -1) : [];

        if (!this.isAllowedFileBaseName(baseName)) continue;
        if (!this.isAllowedFileExtension(extension)) continue;
        if (types.some((type) => !this.isAllowedFileType(type))) continue;

        result.push({
          baseName,
          basePath: relativePath.replace(ext, ""),
          children: [],
          extension,
          fullName,
          fullPath,
          isDirectory,
          isFile,
          parents,
          relativePath,
          types,
        });
      }
    }

    return result;
  }

  private isAllowedDirectoryBaseName(base?: string): boolean {
    if (!base) return false;

    if (this.deniedDirectories.length) {
      for (const regex of this.deniedDirectories) {
        if (regex.test(basename(base))) {
          return false;
        }
      }
    }

    return true;
  }

  private isAllowedFileBaseName(base?: string): boolean {
    if (!base) return false;

    if (this.deniedFilenames.length) {
      for (const regex of this.deniedFilenames) {
        if (regex.test(base)) {
          return false;
        }
      }
    }

    return true;
  }

  private isAllowedFileExtension(extension?: string): boolean {
    if (!extension) return false;

    if (this.deniedExtensions.length) {
      for (const regex of this.deniedExtensions) {
        if (regex.test(extension)) {
          return false;
        }
      }
    }

    return true;
  }

  private isAllowedFileType(type?: string | null): boolean {
    if (!type) return true;

    if (this.deniedTypes.length) {
      for (const regex of this.deniedTypes) {
        if (regex.test(type)) {
          return false;
        }
      }
    }

    return true;
  }
}
