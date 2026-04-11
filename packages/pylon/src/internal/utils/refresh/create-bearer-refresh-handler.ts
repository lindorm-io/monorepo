import { IAegis, VerifyJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { isObject, isString } from "@lindorm/is";
import { PylonSocket } from "../../../types";
import { assertSubjectUnchanged } from "./assert-subject-unchanged";

type CreateBearerRefreshHandlerOptions = {
  aegis: IAegis;
  socket: PylonSocket;
  subject: string;
  verifyOptions: VerifyJwtOptions;
};

export const createBearerRefreshHandler = ({
  aegis,
  socket,
  subject,
  verifyOptions,
}: CreateBearerRefreshHandlerOptions) => {
  return async (payload: unknown): Promise<void> => {
    if (!isObject(payload) || !isString((payload as any).bearer)) {
      throw new ClientError("Invalid refresh payload", {
        details: "Expected { bearer: string }",
        status: ClientError.Status.BadRequest,
      });
    }

    const token = (payload as any).bearer as string;

    const verified = await aegis.verify(token, {
      tokenType: "access_token",
      ...verifyOptions,
    });

    assertSubjectUnchanged(subject, verified.payload.subject);

    // Phase 4 hook: when DPoP lands, assert cnf.jkt unchanged here via
    // assertJktUnchanged(capturedJkt, verified.payload.confirmation?.thumbprint).

    socket.data.tokens.bearer = verified;

    const auth = socket.data.pylon.auth;
    if (auth) {
      const expiresAt = verified.payload.expiresAt ?? new Date(0);
      auth.getExpiresAt = () => expiresAt;
      auth.authExpiredEmittedAt = null;
    }
  };
};
