import { AxiosContext, Context, RequestContext } from "../types";

export const composeContext = (axios: AxiosContext, req: RequestContext): Context => ({
  axios,
  req,
  res: {
    config: {},
    data: {},
    headers: {},
    request: {},
    status: -1,
    statusText: "",
  },
});
