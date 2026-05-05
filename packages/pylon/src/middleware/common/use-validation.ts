import { JwtKit, type ValidateJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import objectPath from "object-path";
import type { PylonMiddleware } from "../../types/index.js";

export const useValidation = (
  tokenPath: string,
  options: ValidateJwtOptions,
): PylonMiddleware =>
  async function validationMiddleware(ctx, next) {
    const timer = ctx.logger.timer();

    try {
      const token = objectPath.get(ctx.state.tokens, tokenPath);

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
