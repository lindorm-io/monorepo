export interface IScanData {
  baseName: string;
  basePath: string;
  children: Array<IScanData>;
  extension: string | null;
  fullName: string;
  fullPath: string;
  isDirectory: boolean;
  isFile: boolean;
  parents: Array<string>;
  relativePath: string;
  types: Array<string>;
}
