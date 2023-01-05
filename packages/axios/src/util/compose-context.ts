import { Context, ContextRequest } from "../types";
import { ILogger } from "@lindorm-io/winston";

export const composeContext = (req: ContextRequest, logger: ILogger): Context => ({
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
