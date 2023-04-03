import { Middleware } from "../../types";
import { MetadataHeader } from "../../enum";

export const axiosDefaultClientHeadersMiddleware: Middleware = async (ctx, next) => {
  if (ctx.req.client.id) {
    ctx.req.headers[MetadataHeader.CLIENT_ID] = ctx.req.client.id;
  }
  if (ctx.req.client.environment) {
    ctx.req.headers[MetadataHeader.CLIENT_ENVIRONMENT] = ctx.req.client.environment;
  }
  if (ctx.req.client.name) {
    ctx.req.headers[MetadataHeader.CLIENT_NAME] = ctx.req.client.name;
  }
  if (ctx.req.client.platform) {
    ctx.req.headers[MetadataHeader.CLIENT_PLATFORM] = ctx.req.client.platform;
  }
  if (ctx.req.client.version) {
    ctx.req.headers[MetadataHeader.CLIENT_VERSION] = ctx.req.client.version;
  }

  await next();
};
