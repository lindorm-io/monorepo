import { Controller, DefaultLindormKoaContext } from "../../types";
import { HttpStatus } from "../../constant";

export const useController =
  <Context extends DefaultLindormKoaContext = DefaultLindormKoaContext>(
    controller: Controller<Context>,
  ) =>
  async (ctx: Context): Promise<void> => {
    const metric = ctx.getMetric("controller");

    ctx.logger.verbose("controller [ start ]", ctx.data);

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

      ctx.logger.verbose("controller [ success ]");
    } catch (err: any) {
      metric.end();

      ctx.logger.verbose("controller [ failure ]", err);

      throw err;
    }
  };
