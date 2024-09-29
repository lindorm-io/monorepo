import { IScanData } from "../interfaces";

export class ScanData implements IScanData {
  private readonly _baseName: string;
  private readonly _basePath: string;
  private readonly _children: Array<IScanData>;
  private readonly _extension: string | null;
  private readonly _fullName: string;
  private readonly _fullPath: string;
  private readonly _isDirectory: boolean;
  private readonly _isFile: boolean;
  private readonly _parents: Array<string>;
  private readonly _relativePath: string;
  private readonly _types: Array<string>;

  public constructor(options: IScanData) {
    this._baseName = options.baseName;
    this._basePath = options.basePath;
    this._children = options.children;
    this._extension = options.extension;
    this._fullName = options.fullName;
    this._fullPath = options.fullPath;
    this._isDirectory = options.isDirectory;
    this._isFile = options.isFile;
    this._parents = options.parents;
    this._relativePath = options.relativePath;
    this._types = options.types;
  }

  public get baseName(): string {
    return this._baseName;
  }

  public get basePath(): string {
    return this._basePath;
  }

  public get children(): Array<IScanData> {
    return [...this._children];
  }

  public get extension(): string | null {
    return this._extension;
  }

  public get fullName(): string {
    return this._fullName;
  }

  public get fullPath(): string {
    return this._fullPath;
  }

  public get isDirectory(): boolean {
    return this._isDirectory;
  }

  public get isFile(): boolean {
    return this._isFile;
  }

  public get parents(): Array<string> {
    return [...this._parents];
  }

  public get relativePath(): string {
    return this._relativePath;
  }

  public get types(): Array<string> {
    return [...this._types];
  }

  public toJSON(): IScanData {
    return {
      baseName: this.baseName,
      basePath: this.basePath,
      children: this.children,
      extension: this.extension,
      fullName: this.fullName,
      fullPath: this.fullPath,
      isDirectory: this.isDirectory,
      isFile: this.isFile,
      parents: this.parents,
      relativePath: this.relativePath,
      types: this.types,
    };
  }
}
