import { Logger } from "@lindorm/logger";
import { config } from "../pylon/config.js";

export const logger = new Logger({
  level: config.logger.level,
  readable: config.nodeEnv !== "production",
});
