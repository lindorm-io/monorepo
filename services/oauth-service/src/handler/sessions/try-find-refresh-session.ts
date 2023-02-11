import { EntityNotFoundError } from "@lindorm-io/entity";
import { LindormScopes } from "@lindorm-io/common-types";
import { RefreshSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { VerifiedIdentityToken } from "../../common";

export const tryFindRefreshSession = async (
  ctx: ServerKoaContext,
  idToken?: VerifiedIdentityToken,
): Promise<RefreshSession | undefined> => {
  const {
    repository: { refreshSessionRepository },
  } = ctx;

  if (!idToken) return;
  if (!idToken.scopes.includes(LindormScopes.OFFLINE_ACCESS)) return;
  if (!idToken.sessionId) return;

  try {
    return await refreshSessionRepository.find({ id: idToken.sessionId });
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) throw err;
  }
};
