import { Controller, DefaultLindormKoaContext } from "../../types";
import { HttpStatus } from "../../constant";

export const useController =
  <Context extends DefaultLindormKoaContext = DefaultLindormKoaContext>(
    controller: Controller<Context>,
  ) =>
  async (ctx: Context): Promise<void> => {
    const logger = ctx.logger.createChildLogger([controller.name]);
    ctx.logger = logger;

    const metric = ctx.getMetric("controller");

    logger.verbose("controller [ start ]", ctx.data);

    try {
      const { body, redirect, status } = (await controller(ctx)) || {};

      if (redirect) {
        ctx.redirect(redirect.toString());

        ctx.body = body || {};
        ctx.status = body
          ? HttpStatus.Redirection.PERMANENT_REDIRECT
          : HttpStatus.Redirection.FOUND;
      } else {
        ctx.body =
          !body && status !== undefined && status !== HttpStatus.Success.NO_CONTENT ? {} : body;
        ctx.status =
          body && !status
            ? HttpStatus.Success.OK
            : !body && !status
            ? HttpStatus.Success.NO_CONTENT
            : status;
      }

      metric.end();

      logger.verbose("controller [ success ]");
    } catch (err: any) {
      metric.end();

      logger.verbose("controller [ failure ]", err);

      throw err;
    }
  };
