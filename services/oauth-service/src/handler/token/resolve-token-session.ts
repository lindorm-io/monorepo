import { SubjectHint } from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { TokenHeaderType, decodeOpaqueToken, getTokenHeaderType } from "@lindorm-io/jwt";
import { OpaqueToken } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";

export const resolveTokenSession = async (
  ctx: ServerKoaContext,
  token: string,
): Promise<OpaqueToken> => {
  const {
    redis: { opaqueTokenCache },
    jwt,
  } = ctx;

  const type = getTokenHeaderType(token);

  if (type === TokenHeaderType.JWT) {
    const verified = jwt.verify<never>(token, {
      audience: configuration.oauth.client_id,
      issuer: configuration.server.issuer,
      subjectHints: [SubjectHint.IDENTITY],
    });

    ctx.token.bearerToken = verified;

    return await opaqueTokenCache.find({ id: verified.id });
  }

  if (type === TokenHeaderType.OPAQUE) {
    const { id, signature } = decodeOpaqueToken(token);
    const opaqueToken = await opaqueTokenCache.find({ id });

    if (signature !== opaqueToken.signature) {
      throw new ClientError("Invalid token signature");
    }

    return opaqueToken;
  }

  throw new ClientError("Invalid token");
};
