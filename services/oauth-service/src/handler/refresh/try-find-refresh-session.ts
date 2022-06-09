import { EntityNotFoundError } from "@lindorm-io/entity";
import { IdentityServiceClaims, Scope } from "../../common";
import { JwtVerifyData } from "@lindorm-io/jwt";
import { RefreshSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { includes } from "lodash";

export const tryFindRefreshSession = async (
  ctx: ServerKoaContext,
  idToken?: JwtVerifyData<never, IdentityServiceClaims>,
): Promise<RefreshSession | undefined> => {
  const {
    repository: { refreshSessionRepository },
  } = ctx;

  if (!idToken) return;
  if (!includes(idToken.scopes, Scope.OFFLINE_ACCESS)) return;

  try {
    return await refreshSessionRepository.find({ id: idToken.sessionId });
  } catch (err) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }
  }
};
