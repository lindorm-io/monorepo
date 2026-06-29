import type { IScanData } from "../interfaces/index.js";

export class ScanData implements IScanData {
  readonly baseName: string;
  readonly basePath: string;
  readonly children: Array<IScanData>;
  readonly extension: string | null;
  readonly fullName: string;
  readonly fullPath: string;
  readonly isDirectory: boolean;
  readonly isFile: boolean;
  readonly parents: Array<string>;
  readonly relativePath: string;
  readonly types: Array<string>;

  constructor(options: IScanData) {
    this.baseName = options.baseName;
    this.basePath = options.basePath;
    this.children = options.children;
    this.extension = options.extension;
    this.fullName = options.fullName;
    this.fullPath = options.fullPath;
    this.isDirectory = options.isDirectory;
    this.isFile = options.isFile;
    this.parents = options.parents;
    this.relativePath = options.relativePath;
    this.types = options.types;
  }
}
