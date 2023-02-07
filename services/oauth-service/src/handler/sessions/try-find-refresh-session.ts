import { EntityNotFoundError } from "@lindorm-io/entity";
import { JwtVerifyData } from "@lindorm-io/jwt";
import { LindormClaims, LindormScopes } from "@lindorm-io/common-types";
import { RefreshSession } from "../../entity";
import { ServerKoaContext } from "../../types";

export const tryFindRefreshSession = async (
  ctx: ServerKoaContext,
  idToken?: JwtVerifyData<never, LindormClaims>,
): Promise<RefreshSession | undefined> => {
  const {
    repository: { refreshSessionRepository },
  } = ctx;

  if (!idToken) return;
  if (!idToken.scopes.includes(LindormScopes.OFFLINE_ACCESS)) return;

  try {
    return await refreshSessionRepository.find({ id: idToken.sessionId });
  } catch (err) {
    if (!(err instanceof EntityNotFoundError)) throw err;
  }
};
