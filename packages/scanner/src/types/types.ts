export type StructureScannerConfig = {
  deniedDirectories: Array<RegExp>;
  deniedExtensions: Array<RegExp>;
  deniedFilenames: Array<RegExp>;
  deniedTypes: Array<RegExp>;
  requireFn: NodeJS.Require;
};

export type StructureScannerOptions = Partial<StructureScannerConfig>;
