import { ScanData, StructureScannerOptions } from "../types";
import { basename, extname, join, relative, sep } from "path";
import { isString } from "@lindorm-io/core";
import { readdirSync, statSync } from "fs";

export class StructureScanner {
  private readonly deniedDirectories: Array<RegExp>;
  private readonly deniedExtensions: Array<RegExp>;
  private readonly deniedFilenames: Array<RegExp>;
  private readonly parentDirection: "default" | "reverse";
  private readonly requireFn: NodeJS.Require;

  public constructor(options: Partial<StructureScannerOptions> = {}) {
    this.deniedDirectories = options.deniedDirectories || [];
    this.deniedExtensions = options.deniedExtensions || [];
    this.deniedFilenames = options.deniedFilenames || [];
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
        result.push(StructureScanner.flatten(item.children));
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
        if (!this.isAllowedDir(fullPath)) continue;

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
        });

        continue;
      }

      if (isFile) {
        if (!this.isAllowedFile(fullPath)) continue;

        const extension = extname(item);
        const baseName = basename(item, extension);

        result.push({
          baseName,
          basePath: relativePath.replace(extension, ""),
          children: [],
          extension,
          fullName,
          fullPath,
          isDirectory,
          isFile,
          parents,
          relativePath,
        });
      }
    }

    return result;
  }

  private isAllowedDir(path: string): boolean {
    if (this.deniedDirectories.length) {
      for (const regex of this.deniedDirectories) {
        if (regex.test(basename(path))) {
          return false;
        }
      }
    }

    return true;
  }

  private isAllowedFile(path: string): boolean {
    return this.isAllowedBase(path) && this.isAllowedExt(path);
  }

  private isAllowedBase(path: string): boolean {
    if (this.deniedFilenames.length) {
      for (const regex of this.deniedFilenames) {
        if (regex.test(basename(path))) {
          return false;
        }
      }
    }

    return true;
  }

  private isAllowedExt(path: string): boolean {
    if (this.deniedExtensions.length) {
      for (const regex of this.deniedExtensions) {
        if (regex.test(extname(path))) {
          return false;
        }
      }
    }

    return true;
  }
}
