import { Middleware } from "../../types";

export const axiosDefaultClientHeadersMiddleware: Middleware = async (ctx, next) => {
  if (ctx.req.client.id) {
    ctx.req.headers["x-client-id"] = ctx.req.client.id;
  }
  if (ctx.req.client.environment) {
    ctx.req.headers["x-client-environment"] = ctx.req.client.environment;
  }
  if (ctx.req.client.name) {
    ctx.req.headers["x-client-name"] = ctx.req.client.name;
  }
  if (ctx.req.client.platform) {
    ctx.req.headers["x-client-platform"] = ctx.req.client.platform;
  }
  if (ctx.req.client.version) {
    ctx.req.headers["x-client-version"] = ctx.req.client.version;
  }

  await next();
};
