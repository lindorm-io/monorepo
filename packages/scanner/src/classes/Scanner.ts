import { isArray, isObjectLike, isString } from "@lindorm/is";
import { readdirSync, statSync } from "fs";
import { basename, extname, join, relative, sep } from "path";
import { ScannerError } from "../errors";
import { IScanData, IScanner } from "../interfaces";
import { StructureScannerOptions } from "../types";
import { ScanData } from "./ScanData";

type RequireFn = (id: string, parentPath: string) => unknown;

export class Scanner implements IScanner {
  private readonly deniedDirectories: Array<RegExp>;
  private readonly deniedExtensions: Array<RegExp>;
  private readonly deniedFilenames: Array<RegExp>;
  private readonly deniedTypes: Array<RegExp>;
  private readonly requireFn: RequireFn;

  public constructor(options: StructureScannerOptions = {}) {
    this.deniedDirectories = options.deniedDirectories || [];
    this.deniedExtensions = options.deniedExtensions || [];
    this.deniedFilenames = options.deniedFilenames || [];
    this.deniedTypes = options.deniedTypes || [];

    if (process.env.JEST_WORKER_ID) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.requireFn = (id: string): unknown => require(id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { require: tsxRequire } = require("tsx/cjs/api");
      this.requireFn = tsxRequire;
    }
  }

  // public

  public scan(path: string): IScanData {
    const root = path.split(sep).slice(0, -1).join(sep);
    const result = this.performScan(path, root);

    if (result) return result;

    throw new ScannerError("No files found");
  }

  public async import<T>(fileOrPath: IScanData | string): Promise<T> {
    const filePath = isString(fileOrPath) ? fileOrPath : fileOrPath.fullPath;
    const { pathToFileURL } = await import("url");
    // Built per-call so it binds to the CURRENT vm realm. Under Jest
    // parallel workers, a module-scoped `new Function` would capture the
    // first test file's realm and later fail with "Provided module is not
    // an instance of Module" once that realm is torn down. Per-call
    // construction is cheap and sidesteps the issue.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const nativeImport = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<unknown>;
    const ns: any = await nativeImport(pathToFileURL(filePath).href);
    return Scanner.normalizeModule(ns) as T;
  }

  // Normalise the ESM namespace returned by dynamic import across runtimes so
  // consumers always see the user's real exports without interop wrappers.
  //
  //   - Jest + ts-jest vm-modules:   { __esModule, default: { <named>, __esModule }, <named> }
  //   - Native Node + tsx CJS hook:  { default: { <named> }, "module.exports": { <named> } }
  //   - Native pure ESM source:      { <named> }  (or { default: X, <named> })
  //
  // In every case we expose { <named>, default: X | undefined } — the same
  // shape the user authored, with no `__esModule` or `module.exports` noise.
  private static normalizeModule(ns: any): Record<string, unknown> {
    if (!isObjectLike(ns)) return ns;

    let source: Record<string, unknown> = ns;

    // Native Node CJS interop stashes the real exports object under
    // "module.exports"; `default` mirrors the same object.
    if (isObjectLike(ns["module.exports"])) {
      source = ns["module.exports"];
    } else if (
      ns.__esModule === true &&
      isObjectLike(ns.default) &&
      (ns.default as Record<string, unknown>).__esModule === true
    ) {
      // Jest + ts-jest vm-modules wraps the CJS exports object as `default`
      // AND copies it to the top level; the nested default carries
      // `__esModule: true` we can use as a fingerprint.
      source = ns.default;
    }

    const { __esModule: _esm, ...userExports } = source;
    void _esm;
    return userExports;
  }

  public require<T>(fileOrPath: IScanData | string): T {
    const filePath = isString(fileOrPath) ? fileOrPath : fileOrPath.fullPath;
    return this.requireFn(filePath, filePath) as T;
  }

  // public static

  public static flatten(scan: Array<IScanData> | IScanData): Array<IScanData> {
    const array = isArray(scan) ? scan : [scan];
    const result: Array<IScanData | Array<IScanData>> = [];

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
    } catch {
      return false;
    }
  }

  // private

  private performScan(path: string, root?: string): IScanData | undefined {
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

      const children: Array<IScanData> = [];

      for (const content of readdirSync(path)) {
        const child = this.performScan(join(path, content), rootDir);

        if (!child) continue;

        children.push(child);
      }

      return new ScanData({
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
      });
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

      return new ScanData({
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
