import { Middleware } from "../../types";
import { Environment } from "../../enum";

interface Options {
  domain?: string;
  environment?: Environment;
  host: string;
}

export const serverInfoMiddleware =
  (options: Options): Middleware =>
  async (ctx, next): Promise<void> => {
    ctx.server = {
      domain: options.domain || options.host,
      environment: options.environment || Environment.DEVELOPMENT,
      host: options.host,
    };

    await next();
  };
