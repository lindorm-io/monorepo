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
        throw new ClientError("Token not found", {
          status: ClientError.Status.Unauthorized,
          code: "token_not_found",
          type: "urn:lindorm:pylon:error:token_not_found",
          title: "Token Not Found",
          details: `Expected a token at path [${tokenPath}] on context state tokens`,
          data: { token: tokenPath },
        });
      }

      JwtKit.validate(token, options);

      timer.debug("Token validation successful");
    } catch (err: any) {
      timer.debug("Token validation failed", err);

      if (err instanceof ClientError) {
        throw err;
      }

      throw new ClientError("Token validation failed", {
        error: err,
        status: ClientError.Status.Forbidden,
        code: "token_validation_failed",
        type: "urn:lindorm:pylon:error:token_validation_failed",
        title: "Token Validation Failed",
        details: err.message,
        data: { token: tokenPath },
      });
    }

    await next();
  };
