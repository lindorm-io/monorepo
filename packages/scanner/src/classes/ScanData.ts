import { IScanData } from "../interfaces";

export class ScanData implements IScanData {
  public readonly baseName: string;
  public readonly basePath: string;
  public readonly children: Array<IScanData>;
  public readonly extension: string | null;
  public readonly fullName: string;
  public readonly fullPath: string;
  public readonly isDirectory: boolean;
  public readonly isFile: boolean;
  public readonly parents: Array<string>;
  public readonly relativePath: string;
  public readonly types: Array<string>;

  public constructor(options: IScanData) {
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
