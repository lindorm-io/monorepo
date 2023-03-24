import { ClientError } from "@lindorm-io/errors";
import { OpaqueTokenType } from "../../enum";
import { ServerKoaMiddleware } from "../../types";
import { resolveTokenSession } from "../../handler";

export const customIdentityAuthMiddleware: ServerKoaMiddleware = async (ctx, next) => {
  const {
    mongo: { clientSessionRepository },
  } = ctx;

  const metric = ctx.getMetric("auth");

  try {
    const { type: tokenType, value: token } = ctx.getAuthorizationHeader() || {};

    if (tokenType !== "Bearer") {
      throw new ClientError("Invalid token type", {
        debug: { tokenType, token },
      });
    }

    const accessToken = await resolveTokenSession(ctx, token);

    if (accessToken.type !== OpaqueTokenType.ACCESS) {
      throw new ClientError("Invalid token type", {
        debug: { type: accessToken.type },
      });
    }

    ctx.entity.opaqueToken = accessToken;

    ctx.entity.clientSession = await clientSessionRepository.find({
      id: accessToken.clientSessionId,
    });

    ctx.logger.debug("Bearer token validated", { token });
  } catch (err: any) {
    throw new ClientError("Invalid Authorization", {
      error: err,
      description: "Bearer Token is invalid",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  } finally {
    metric.end();
  }

  await next();
};
