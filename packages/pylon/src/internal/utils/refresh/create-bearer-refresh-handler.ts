import type { IAegis, VerifyJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { isNumber, isObject, isString } from "@lindorm/is";
import type { PylonSocket } from "../../../types/index.js";
import { assertJktUnchanged } from "./assert-jkt-unchanged.js";
import { assertSubjectUnchanged } from "./assert-subject-unchanged.js";

type CreateBearerRefreshHandlerOptions = {
  aegis: IAegis;
  capturedJkt?: string;
  socket: PylonSocket;
  subject: string;
  verifyOptions: VerifyJwtOptions;
};

export const createBearerRefreshHandler = ({
  aegis,
  capturedJkt,
  socket,
  subject,
  verifyOptions,
}: CreateBearerRefreshHandlerOptions) => {
  return async (payload: unknown): Promise<void> => {
    if (
      !isObject(payload) ||
      !isString((payload as any).bearer) ||
      !isNumber((payload as any).expiresIn) ||
      (payload as any).expiresIn <= 0
    ) {
      throw new ClientError("Invalid refresh payload", {
        details: "Expected { bearer: string, expiresIn: number }",
        status: ClientError.Status.BadRequest,
      });
    }

    const token = (payload as any).bearer as string;
    const expiresIn = (payload as any).expiresIn as number;

    // The DPoP binding is established once at handshake time; refresh events
    // do not re-present a DPoP proof per the socket-auth plan. Tell aegis to
    // trust the existing jkt binding for this verify call, then compare the
    // new token's cnf.jkt against the captured one below.
    const verified = await aegis.verify(token, {
      tokenType: "access_token",
      ...verifyOptions,
      trustBoundThumbprint: capturedJkt !== undefined,
    });

    assertSubjectUnchanged(subject, verified.payload.subject);

    assertJktUnchanged(capturedJkt, (verified.payload as any).confirmation?.thumbprint);

    socket.data.tokens.bearer = verified;

    const auth = socket.data.pylon.auth;
    if (auth) {
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      auth.getExpiresAt = () => expiresAt;
      auth.authExpiredEmittedAt = null;
    }
  };
};
