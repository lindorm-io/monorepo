import { JwtKit, ValidateJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { get } from "object-path";
import { PylonHttpMiddleware } from "../../types";

export const useValidation = (
  tokenPath: string,
  options: ValidateJwtOptions,
): PylonHttpMiddleware =>
  async function httpValidationMiddleware(ctx, next) {
    const timer = ctx.logger.time();

    try {
      const token = get(ctx.state.tokens, tokenPath);

      if (!token) {
        throw new ClientError("Token not found");
      }

      JwtKit.validate(token, options);

      timer.debug("Token validation successful");
    } catch (err: any) {
      timer.debug("Token validation failed", err);

      throw new ClientError(err.message, {
        error: err,
        status: ClientError.Status.Forbidden,
      });
    }

    await next();
  };
