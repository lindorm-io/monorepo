import { Context, ContextRequest } from "../types";
import { Logger } from "@lindorm-io/core-logger";

export const composeContext = (req: ContextRequest, logger: Logger): Context => ({
  req,
  res: {
    config: {},
    data: {},
    headers: {},
    request: {},
    status: -1,
    statusText: "",
  },
  logger,
});
