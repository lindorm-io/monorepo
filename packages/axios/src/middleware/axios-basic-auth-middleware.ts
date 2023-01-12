import { AxiosBasicCredentials } from "axios";
import { Middleware } from "../types";

export const axiosBasicAuthMiddleware =
  (credentials: AxiosBasicCredentials): Middleware =>
  async (ctx, next) => {
    ctx.req.auth = credentials;

    await next();
  };
