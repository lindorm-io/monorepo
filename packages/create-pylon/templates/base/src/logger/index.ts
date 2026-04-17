import { Logger } from "@lindorm/logger";

export const logger = new Logger({
  readable: process.env.NODE_ENV !== "production",
});
