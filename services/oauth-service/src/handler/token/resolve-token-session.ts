import { SubjectHint } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { TokenHeaderType, parseTokenHeader } from "@lindorm-io/jwt";
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

  const { typ } = parseTokenHeader(token);

  if (typ === TokenHeaderType.JWT) {
    const verified = jwt.verify(token, {
      audience: configuration.oauth.client_id,
      issuer: configuration.server.issuer,
      subjectHints: [SubjectHint.IDENTITY],
    });

    return await opaqueTokenCache.find({ id: verified.id });
  }

  if (typ === TokenHeaderType.OPAQUE) {
    return await opaqueTokenCache.find({ token });
  }

  throw new ClientError("Invalid token");
};
