import { JwtKit, ValidateJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { get } from "object-path";
import { PylonHttpMiddleware } from "../../types";

export const useValidation = (
  tokenPath: string,
  options: ValidateJwtOptions,
): PylonHttpMiddleware =>
  async function httpValidationMiddleware(ctx, next) {
    const start = Date.now();

    try {
      const token = get(ctx.state.tokens, tokenPath);

      if (!token) {
        throw new ClientError("Token not found");
      }

      JwtKit.validate(token, options);

      ctx.logger.debug("Token validation successful", {
        time: Date.now() - start,
      });
    } catch (error: any) {
      ctx.logger.debug("Token validation failed", error);

      throw new ClientError(error.message, {
        error,
        status: ClientError.Status.Forbidden,
      });
    }

    await next();
  };
