import { basename, extname, join, relative, sep } from "path";
import { flatten } from "lodash";
import { readdirSync, statSync } from "fs";

export interface StructureScannerOptions {
  excludeExtensions?: Array<string>;
  includeExtensions?: Array<string>;
  omitFileNamesFromRoute?: Array<string>;
  renameRoutes?: Record<string, string>;
  routesPrefix?: string;
}

export interface FileData {
  name: string;
  path: string;
  relative: string;
  parents: Array<string>;
}

export class StructureScanner {
  private readonly directory: string;
  private readonly exclude: Array<string>;
  private readonly include: Array<string>;
  private readonly omit: Array<string>;
  private readonly prefix: string;
  private readonly rename: Record<string, string>;

  public constructor(directory: string, options: StructureScannerOptions = {}) {
    this.directory = directory;
    this.exclude = options.excludeExtensions || [".integration.ts", ".spec.ts", ".test.ts"];
    this.include = options.includeExtensions || [".js", ".ts"];
    this.omit = options.omitFileNamesFromRoute || ["index"];
    this.prefix = options.routesPrefix || "";
    this.rename = options.renameRoutes || {};
  }

  public scan(): Array<FileData> {
    return this.scanDirectory(this.directory);
  }

  public getRoute(file: FileData): string {
    const omit = this.omit.includes(file.name);

    if (!file.parents.length && !omit) {
      return this.renameRoute(`${this.prefix}/${file.name}`);
    }

    if (omit) {
      return this.renameRoute(`${this.prefix}/${file.parents.join("/")}`);
    }

    return this.renameRoute(`${this.prefix}/${file.parents.join("/")}/${file.name}`);
  }

  public static hasItems(directory: string): boolean {
    try {
      const items = readdirSync(directory);
      return items.length > 0;
    } catch (_) {
      return false;
    }
  }

  private scanDirectory(directory: string): Array<FileData> {
    const files = readdirSync(directory);
    const array = [];

    for (const file of files) {
      const filePath = join(directory, file);
      const relativePath = relative(this.directory, filePath);
      const stats = statSync(filePath);

      if (stats.isFile() && this.isApprovedExtension(file) && !this.isExcludedExtension(file)) {
        array.push({
          name: basename(file, extname(file)),
          parents: relativePath.split(sep).slice(0, -1),
          path: filePath,
          relative: relativePath,
        });
      } else if (stats.isDirectory()) {
        array.push(this.scanDirectory(filePath));
      }
    }

    return flatten(array);
  }

  private isApprovedExtension(file: string): boolean {
    for (const extension of this.include) {
      if (file.endsWith(extension)) return true;
    }
    return false;
  }

  private isExcludedExtension(file: string): boolean {
    for (const exclude of this.exclude) {
      if (file.includes(exclude)) return true;
    }
    return false;
  }

  private renameRoute(name: string): string {
    return typeof this.rename[name] === "string" ? this.rename[name] : name;
  }
}
