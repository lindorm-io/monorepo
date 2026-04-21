import { Amphora } from "@lindorm/amphora";
import { logger } from "../logger/index.js";
import { config } from "./config";

export const amphora = new Amphora({ logger });

amphora.env(config.pylon.kek);
