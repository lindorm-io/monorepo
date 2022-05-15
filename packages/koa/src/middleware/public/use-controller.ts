import { Controller, DefaultLindormKoaContext } from "../../types";
import { HttpStatus } from "../../constant";

export const useController =
  <Context extends DefaultLindormKoaContext = DefaultLindormKoaContext>(
    controller: Controller<Context>,
    controllerName?: string,
  ) =>
  async (ctx: Context): Promise<void> => {
    const name = controllerName || controller.name || "controller";
    const metric = ctx.getMetric(name);

    ctx.logger.verbose(`${name} [ start ]`, ctx.data);

    try {
      const { body, redirect, status } = await controller(ctx);

      if (redirect) {
        ctx.redirect(redirect.toString());

        ctx.status = body
          ? HttpStatus.Redirection.PERMANENT_REDIRECT
          : HttpStatus.Redirection.FOUND;
      } else {
        ctx.status = body ? HttpStatus.Success.OK : HttpStatus.Success.NO_CONTENT;
      }

      ctx.body = body || ctx.body;
      ctx.status = status || ctx.status;

      metric.end();

      ctx.logger.verbose(`${name} [ success ]`);
    } catch (err: any) {
      metric.end();

      ctx.logger.verbose(`${name} [ failure ]`, err);

      throw err;
    }
  };
