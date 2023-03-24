import { ClientError } from "@lindorm-io/errors";
import { OpaqueToken } from "../../entity";
import { ServerKoaContext } from "../../types";
import { baseParse } from "@lindorm-io/core";
import { configuration } from "../../server/configuration";
import { SubjectHint } from "@lindorm-io/common-types";

export const resolveTokenSession = async (
  ctx: ServerKoaContext,
  token: string,
): Promise<OpaqueToken> => {
  const {
    redis: { opaqueTokenCache },
    jwt,
  } = ctx;

  const [header] = token.split(".");
  const parsed = JSON.parse(baseParse(header));

  if (parsed.typ === "JWT") {
    const verified = jwt.verify(token, {
      audience: configuration.oauth.client_id,
      issuer: configuration.server.issuer,
      subjectHints: [SubjectHint.IDENTITY],
    });

    return await opaqueTokenCache.find({ id: verified.id });
  }

  if (parsed.typ === "OPAQUE") {
    return await opaqueTokenCache.find({ token });
  }

  throw new ClientError("Invalid token");
};
