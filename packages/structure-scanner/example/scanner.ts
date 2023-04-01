import { StructureScanner } from "../src";
import { LogLevel, WinstonLogger } from "@lindorm-io/winston";

const logger = new WinstonLogger();
logger.addConsole(LogLevel.INFO, { readable: true, colours: true });

const scanner = new StructureScanner({
  deniedFilenames: [/.*[.]test/, /scanner/],
});

const hasFiles = StructureScanner.hasFiles(__dirname);
const files = scanner.scan(__dirname);
const flat = StructureScanner.flatten(files);

logger.info("files", { hasFiles, files, flat });

// const file4 = files.find((f) => f.baseName === "file4");
//
// if (file4) {
//   const req = scanner.require<any>(file4.fullPath);
//   console.log(req);
// }
//
// const file9 = files.find((f) => f.baseName === "[file9]");
//
// if (file9) {
//   const imported = scanner.import<any>(file9);
//   imported.then((i) => console.log(i.default)).finally(() => process.exit());
// }
