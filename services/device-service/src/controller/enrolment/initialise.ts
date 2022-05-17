import Joi from "joi";
import { CertificateMethod, TokenType } from "../../enum";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { EnrolmentSession } from "../../entity";
import { JOI_CERTIFICATE_METHOD } from "../../constant";
import { RdcSessionMode, RdcSessionType, SessionStatus, SubjectHint } from "../../common";
import { configuration } from "../../server/configuration";
import { createRdcSession, isRdcRequired } from "../../handler";
import { getExpires } from "@lindorm-io/core";
import { getRandomString } from "@lindorm-io/core";

interface RequestData {
  brand: string | null;
  buildId: string | null;
  buildNumber: string | null;
  certificateMethod: CertificateMethod;
  macAddress: string | null;
  model: string | null;
  publicKey: string;
  systemName: string | null;
}

interface ResponseBody {
  certificateChallenge: string;
  enrolmentSessionId: string;
  enrolmentSessionToken: string;
  expiresIn: number;
  externalChallengeRequired: boolean;
}

export const initialiseEnrolmentSchema = Joi.object<RequestData>({
  brand: Joi.string().required(),
  buildId: Joi.string().required(),
  buildNumber: Joi.string().required(),
  certificateMethod: JOI_CERTIFICATE_METHOD.required(),
  macAddress: Joi.string().required(),
  model: Joi.string().required(),
  publicKey: Joi.string().required(),
  systemName: Joi.string().required(),
});

export const initialiseEnrolmentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { enrolmentSessionCache },
    data: {
      brand,
      buildId,
      buildNumber,
      certificateMethod,
      macAddress,
      model,
      publicKey,
      systemName,
    },
    jwt,
    metadata: {
      client: { id: clientId },
      device: { installationId, name, uniqueId, systemVersion },
      identifiers: { fingerprint },
    },
    token: {
      bearerToken: { subject: identityId },
    },
  } = ctx;

  const certificateChallenge = getRandomString(128);

  const { expires, expiresIn } = getExpires(configuration.expiry.enrolment_session);

  const externalChallengeRequired = await isRdcRequired(ctx, identityId);
  const nonce = getRandomString(16);

  const session = await enrolmentSessionCache.create(
    new EnrolmentSession({
      certificateChallenge,
      certificateMethod,
      deviceMetadata: {
        brand,
        buildId,
        buildNumber,
        macAddress,
        model,
        systemName,
      },
      fingerprint,
      identityId,
      installationId,
      name,
      nonce,
      publicKey,
      status: externalChallengeRequired ? SessionStatus.PENDING : SessionStatus.SKIP,
      uniqueId,
    }),
    expiresIn,
  );

  const { token } = jwt.sign({
    audiences: [clientId],
    expiry: configuration.expiry.enrolment_session,
    sessionId: session.id,
    subject: identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ENROLMENT_SESSION_TOKEN,
  });

  if (externalChallengeRequired) {
    await createRdcSession(ctx, {
      enrolmentSessionId: session.id,
      expires,
      factors: 2,
      identityId,
      mode: RdcSessionMode.QR_CODE,
      nonce,
      templateName: "enrolment",
      templateParameters: {
        brand,
        model,
        name,
        systemName,
        systemVersion,
      },
      type: RdcSessionType.ENROLMENT,
    });
  }

  return {
    body: {
      certificateChallenge,
      enrolmentSessionId: session.id,
      enrolmentSessionToken: token,
      expiresIn,
      externalChallengeRequired,
    },
  };
};
