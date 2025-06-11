import { JwtKit, ValidateJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { get } from "object-path";
import { PylonHttpMiddleware } from "../../types";

export const useValidation = (
  tokenPath: string,
  options: ValidateJwtOptions,
): PylonHttpMiddleware =>
  async function httpValidationMiddleware(ctx, next) {
    const metric = ctx.metric("httpValidationMiddleware");

    try {
      const token = get(ctx.state.tokens, tokenPath);

      if (!token) {
        throw new ClientError("Token not found");
      }

      JwtKit.validate(token, options);

      ctx.logger.debug("Token validation successful");
    } catch (err: any) {
      ctx.logger.debug("Token validation failed", err);

      throw new ClientError(err.message, {
        error: err,
        status: ClientError.Status.Forbidden,
      });
    } finally {
      metric.end();
    }

    await next();
  };
