import { Logger } from "@lindorm/logger";
import { config } from "../pylon/config";

export const logger = new Logger({
  readable: config.nodeEnv !== "production",
});
