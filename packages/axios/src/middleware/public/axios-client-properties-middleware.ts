import { AxiosClientProperties, Middleware } from "../../types";

type Options = Partial<AxiosClientProperties>;

export const axiosClientPropertiesMiddleware =
  ({ id, environment, name, platform, version }: Options): Middleware =>
  async (ctx, next) => {
    if (id !== undefined) {
      ctx.req.client.id = id;
    }
    if (environment !== undefined) {
      ctx.req.client.environment = environment;
    }
    if (name !== undefined) {
      ctx.req.client.name = name;
    }
    if (platform !== undefined) {
      ctx.req.client.platform = platform;
    }
    if (version !== undefined) {
      ctx.req.client.version = version;
    }

    await next();
  };
