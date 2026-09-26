import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Logger } from "@lindorm/logger";
import { LindormWorkerScanner } from "../src/index.js";

const logger = new Logger({ level: "info", readable: true });

const directory = join(dirname(fileURLToPath(import.meta.url)), "workers");

const workers = await LindormWorkerScanner.scan([directory], logger);

for (const worker of workers) {
  console.log("scanned > ", worker.alias, worker.nextRun);
}
