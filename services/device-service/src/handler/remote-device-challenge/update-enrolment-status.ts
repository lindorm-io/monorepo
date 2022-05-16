import { ServerKoaContext } from "../../types";
import { RdcSession } from "../../entity";

export const updateEnrolmentStatus = async (
  ctx: ServerKoaContext,
  rdcSession: RdcSession,
): Promise<void> => {
  const {
    cache: { enrolmentSessionCache },
  } = ctx;

  const enrolmentSession = await enrolmentSessionCache.find({
    id: rdcSession.enrolmentSessionId,
  });

  enrolmentSession.status = rdcSession.status;

  await enrolmentSessionCache.update(enrolmentSession);
};
