import { ServerKoaContext } from "../../types";
import { RdcSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";

export const updateEnrolmentStatus = async (
  ctx: ServerKoaContext,
  rdcSession: RdcSession,
): Promise<void> => {
  const {
    cache: { enrolmentSessionCache },
  } = ctx;

  if (!rdcSession.enrolmentSessionId) {
    throw new ServerError("Invalid rdcSession", {
      debug: { enrolmentSessionId: rdcSession.enrolmentSessionId },
    });
  }

  const enrolmentSession = await enrolmentSessionCache.find({
    id: rdcSession.enrolmentSessionId,
  });

  enrolmentSession.status = rdcSession.status;

  await enrolmentSessionCache.update(enrolmentSession);
};
