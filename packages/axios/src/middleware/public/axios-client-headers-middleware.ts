import { Middleware } from "../../types";

export type AxiosClientProperties = {
  id: string | null;
  environment: string | null;
  name: string | null;
  platform: string | null;
  version: string | null;
};

export const axiosClientHeadersMiddleware =
  (client: Partial<AxiosClientProperties>): Middleware =>
  async (ctx, next) => {
    if (client.id) {
      ctx.req.headers["x-client-id"] = client.id;
    }
    if (client.environment) {
      ctx.req.headers["x-client-environment"] = client.environment;
    }
    if (client.name) {
      ctx.req.headers["x-client-name"] = client.name;
    }
    if (client.platform) {
      ctx.req.headers["x-client-platform"] = client.platform;
    }
    if (client.version) {
      ctx.req.headers["x-client-version"] = client.version;
    }

    await next();
  };
