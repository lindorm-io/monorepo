import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { DeviceLink } from "../../entity";
import { DeviceLinkSalt, ServerKoaController } from "../../types";
import { JOI_BIOMETRY, JOI_PINCODE } from "../../constant";
import { assertCertificateChallenge } from "../../util";
import { configuration } from "../../server/configuration";
import { createDeviceLinkCallback } from "../../handler";
import { flatten } from "lodash";
import { randomString } from "@lindorm-io/core";
import {
  ChallengeConfirmationTokenClaims,
  ChallengeStrategy,
  DeviceFactor,
  JOI_GUID,
  JOI_JWT,
  SessionStatus,
  SubjectHint,
  TokenType,
} from "../../common";

interface RequestData {
  id: string;
  biometry: string;
  certificateVerifier: string;
  enrolmentSessionToken: string;
  pincode: string;
}

interface ResponseBody {
  challengeConfirmationToken: string;
  deviceLinkId: string;
  expiresIn: number;
  trusted: boolean;
}

export const confirmEnrolmentSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    biometry: JOI_BIOMETRY.optional(),
    certificateVerifier: Joi.string().base64().required(),
    enrolmentSessionToken: JOI_JWT.required(),
    pincode: JOI_PINCODE.optional(),
  })
  .required();

export const confirmEnrolmentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { enrolmentSessionCache },
    data: { biometry, certificateVerifier, pincode },
    entity: { enrolmentSession },
    jwt,
    repository: { deviceLinkRepository },
  } = ctx;

  await assertCertificateChallenge({
    certificateChallenge: enrolmentSession.certificateChallenge,
    certificateMethod: enrolmentSession.certificateMethod,
    certificateVerifier,
    publicKey: enrolmentSession.publicKey,
  });

  const trusted = [SessionStatus.CONFIRMED, SessionStatus.SKIP].includes(enrolmentSession.status);
  const salt: DeviceLinkSalt = {
    aes: randomString(128),
    sha: randomString(128),
  };
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  const deviceLink = await deviceLinkRepository.create(
    new DeviceLink({
      active: true,
      biometry: biometry ? await crypto.encrypt(biometry) : undefined,
      certificateMethod: enrolmentSession.certificateMethod,
      identityId: enrolmentSession.identityId,
      installationId: enrolmentSession.installationId,
      metadata: enrolmentSession.deviceMetadata,
      name: enrolmentSession.name,
      pincode: pincode ? await crypto.encrypt(pincode) : undefined,
      publicKey: enrolmentSession.publicKey,
      trusted,
      uniqueId: enrolmentSession.uniqueId,
    }),
    createDeviceLinkCallback(ctx, salt),
  );

  const { expiresIn, token } = jwt.sign<Record<string, unknown>, ChallengeConfirmationTokenClaims>({
    audiences: flatten([configuration.oauth.client_id, enrolmentSession.audiences]),
    claims: {
      deviceLinkId: deviceLink.id,
      factors: [DeviceFactor.POSSESSION],
      strategy: ChallengeStrategy.IMPLICIT,
    },
    expiry: configuration.defaults.challenge_confirmation_token_expiry,
    nonce: enrolmentSession.nonce,
    scopes: ["enrolment"],
    sessionId: enrolmentSession.id,
    subject: deviceLink.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE_CONFIRMATION,
  });

  await enrolmentSessionCache.destroy(enrolmentSession);

  return {
    body: {
      challengeConfirmationToken: token,
      deviceLinkId: deviceLink.id,
      expiresIn,
      trusted,
    },
  };
};
