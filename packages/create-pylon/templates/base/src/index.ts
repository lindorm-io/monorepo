import { logger } from "./logger/index.js";
import { pylon } from "./pylon/pylon.js";

// `start()` rejects when the bind fails — EADDRINUSE, or EACCES on a privileged
// port. Handle it: a floated promise turns a named startup failure into an
// unhandled rejection with no log line, and the exit code stops meaning anything
// to whatever supervises the process.
pylon.start().catch((error) => {
  logger.error("Pylon failed to start", error);
  process.exit(1);
});
