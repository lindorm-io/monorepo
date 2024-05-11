export type StructureScannerOptions = {
  deniedDirectories: Array<RegExp>;
  deniedExtensions: Array<RegExp>;
  deniedFilenames: Array<RegExp>;
  deniedTypes: Array<RegExp>;
  parentDirection: "default" | "reverse";
  requireFn: NodeJS.Require;
};

export type ScanData = {
  baseName: string;
  basePath: string;
  children: Array<ScanData>;
  extension: string | null;
  fullName: string;
  fullPath: string;
  isDirectory: boolean;
  isFile: boolean;
  parents: Array<string>;
  relativePath: string;
  types: Array<string>;
};
