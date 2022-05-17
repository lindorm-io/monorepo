import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { DeviceLink, DeviceLinkSalt } from "../../entity";
import { JOI_BIOMETRY, JOI_PINCODE } from "../../constant";
import { ServerKoaController } from "../../types";
import { TokenType } from "../../enum";
import { assertCertificateChallenge } from "../../util";
import { configuration } from "../../server/configuration";
import { getRandomString } from "@lindorm-io/core";
import { includes } from "lodash";
import {
  ChallengeConfirmationTokenClaims,
  ChallengeStrategy,
  DeviceFactor,
  JOI_GUID,
  JOI_JWT,
  SessionStatus,
  SubjectHint,
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

export const confirmEnrolmentSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  biometry: JOI_BIOMETRY.optional(),
  certificateVerifier: Joi.string().base64().required(),
  enrolmentSessionToken: JOI_JWT.required(),
  pincode: JOI_PINCODE.optional(),
});

export const confirmEnrolmentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { enrolmentSessionCache },
    data: { biometry, certificateVerifier, pincode },
    entity: { enrolmentSession },
    jwt,
    metadata: {
      client: { id: clientId },
    },
    repository: { deviceLinkRepository },
  } = ctx;

  await assertCertificateChallenge({
    certificateChallenge: enrolmentSession.certificateChallenge,
    certificateMethod: enrolmentSession.certificateMethod,
    certificateVerifier,
    publicKey: enrolmentSession.publicKey,
  });

  const trusted = includes([SessionStatus.CONFIRMED, SessionStatus.SKIP], enrolmentSession.status);
  const salt: DeviceLinkSalt = {
    aes: getRandomString(128),
    sha: getRandomString(128),
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
      deviceMetadata: enrolmentSession.deviceMetadata,
      fingerprint: enrolmentSession.fingerprint,
      identityId: enrolmentSession.identityId,
      installationId: enrolmentSession.installationId,
      name: enrolmentSession.name,
      pincode: pincode ? await crypto.encrypt(pincode) : undefined,
      publicKey: enrolmentSession.publicKey,
      salt,
      trusted,
      uniqueId: enrolmentSession.uniqueId,
    }),
  );

  const { expiresIn, token } = jwt.sign<Record<string, unknown>, ChallengeConfirmationTokenClaims>({
    audiences: [clientId],
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
    type: TokenType.CHALLENGE_CONFIRMATION_TOKEN,
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
