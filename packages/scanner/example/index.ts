import { LindormLogger } from "@lindorm/logger";
import { StructureScanner } from "../src";

const logger = new LindormLogger({ readable: true });

const scanner = new StructureScanner({
  deniedFilenames: [/.*[.]test/, /scanner/],
});

const hasFiles = StructureScanner.hasFiles(__dirname);
const files = scanner.scan(__dirname);
const flat = StructureScanner.flatten(files);

logger.info("files", { hasFiles, files, flat });

const file4 = flat.find((f) => f.baseName === "file4");

if (file4) {
  const req = scanner.require<any>(file4.fullPath);
  logger.info("required", req);
}

const file9 = flat.find((f) => f.baseName === "[file9]");

if (file9) {
  const imported = scanner.import<any>(file9);
  imported.then((i) => logger.info("imported", i.default)).finally(() => process.exit());
}
