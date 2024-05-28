import { isArray, isString } from "@lindorm/is";
import { readdirSync, statSync } from "fs";
import { basename, extname, join, relative, sep } from "path";
import { ScannerError } from "../errors";
import { IScanner } from "../interfaces";
import { ScanData, StructureScannerOptions } from "../types";

export class Scanner implements IScanner {
  private readonly deniedDirectories: Array<RegExp>;
  private readonly deniedExtensions: Array<RegExp>;
  private readonly deniedFilenames: Array<RegExp>;
  private readonly deniedTypes: Array<RegExp>;
  private readonly requireFn: NodeJS.Require;

  public constructor(options: Partial<StructureScannerOptions> = {}) {
    this.deniedDirectories = options.deniedDirectories || [];
    this.deniedExtensions = options.deniedExtensions || [];
    this.deniedFilenames = options.deniedFilenames || [];
    this.deniedTypes = options.deniedTypes || [];

    this.requireFn = options.requireFn || require;
  }

  // public

  public scan(path: string): ScanData {
    const root = path.split(sep).slice(0, -1).join(sep);
    const result = this.performScan(path, root);

    if (result) return result;

    throw new ScannerError("No files found");
  }

  public async import<T>(fileOrPath: ScanData | string): Promise<T> {
    return await import(isString(fileOrPath) ? fileOrPath : fileOrPath.fullPath);
  }

  public require<T>(fileOrPath: ScanData | string): T {
    return this.requireFn(isString(fileOrPath) ? fileOrPath : fileOrPath.fullPath);
  }

  // public static

  public static flatten(scan: Array<ScanData> | ScanData): Array<ScanData> {
    const array = isArray(scan) ? scan : [scan];
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

  private performScan(path: string, root?: string): ScanData | undefined {
    const rootDir = root ?? path;

    const fullPath = path;
    const fullName = basename(fullPath);
    const relativePath = relative(rootDir, fullPath);
    const stats = statSync(fullPath);

    const isDirectory = stats.isDirectory();
    const isFile = stats.isFile();

    const parents = relativePath.split(sep).slice(0, -1);

    if (isDirectory) {
      if (!this.isAllowedDirectoryBaseName(fullName)) return;

      const children: Array<ScanData> = [];

      for (const content of readdirSync(path)) {
        const child = this.performScan(join(path, content), rootDir);

        if (!child) continue;

        children.push(child);
      }

      return {
        baseName: fullName,
        basePath: relativePath,
        children,
        extension: null,
        fullName,
        fullPath,
        isDirectory,
        isFile,
        parents,
        relativePath,
        types: [],
      };
    }

    if (isFile) {
      const ext = extname(path);
      const [_, extension] = ext.split(".");
      const nameArray = basename(path, ext).split(".");
      const baseName = nameArray[0];
      const types = nameArray.length > 1 ? nameArray.reverse().slice(0, -1) : [];

      if (!this.isAllowedFileBaseName(baseName)) return;
      if (!this.isAllowedFileExtension(extension)) return;
      if (types.some((type) => !this.isAllowedFileType(type))) return;

      return {
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
      };
    }
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
