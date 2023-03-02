import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { JOI_BIOMETRY, JOI_PINCODE, JOI_STRATEGY } from "../../constant";
import { ServerKoaController } from "../../types";
import { assertCertificateChallenge } from "../../util";
import { configuration } from "../../server/configuration";
import { flatten } from "lodash";
import { vaultGetSalt } from "../../handler";
import { ChallengeConfirmationTokenClaims, JOI_JWT } from "../../common";
import {
  ChallengeStrategy,
  ConfirmChallengeRequestBody,
  ConfirmChallengeRequestParams,
  ConfirmChallengeResponse,
  DeviceTokenType,
  PSD2Factor,
  SubjectHint,
} from "@lindorm-io/common-types";

type RequestData = ConfirmChallengeRequestParams & ConfirmChallengeRequestBody;

type ResponseBody = ConfirmChallengeResponse;

export const confirmChallengeSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    biometry: Joi.when("strategy", {
      is: ChallengeStrategy.BIOMETRY,
      then: JOI_BIOMETRY.required(),
      otherwise: Joi.forbidden(),
    }),
    certificateVerifier: Joi.string().base64().required(),
    challengeSessionToken: JOI_JWT.required(),
    pincode: Joi.when("strategy", {
      is: ChallengeStrategy.PINCODE,
      then: JOI_PINCODE.required(),
      otherwise: Joi.forbidden(),
    }),
    strategy: JOI_STRATEGY.required(),
  })
  .required();

export const confirmChallengeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { challengeSessionCache },
    data: { certificateVerifier, pincode, biometry, strategy },
    entity: { challengeSession, deviceLink },
    jwt,
    metadata,
    repository: { deviceLinkRepository },
    token: { challengeSessionToken },
  } = ctx;

  if (challengeSession.id !== challengeSessionToken.session) {
    throw new ClientError("Invalid challenge session token");
  }

  if (!challengeSession.strategies.includes(strategy)) {
    throw new ClientError("Invalid strategy");
  }

  if (
    deviceLink.id !== metadata.device.linkId ||
    deviceLink.installationId !== metadata.device.installationId ||
    deviceLink.uniqueId !== metadata.device.uniqueId
  ) {
    throw new ClientError("Invalid metadata");
  }

  await assertCertificateChallenge({
    certificateChallenge: challengeSession.certificateChallenge,
    certificateMethod: deviceLink.certificateMethod,
    certificateVerifier,
    publicKey: deviceLink.publicKey,
  });

  const factors: Array<PSD2Factor> = [PSD2Factor.POSSESSION];

  const salt = await vaultGetSalt(ctx, deviceLink);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  switch (strategy) {
    case ChallengeStrategy.IMPLICIT:
      break;

    case ChallengeStrategy.PINCODE:
      await crypto.assert(pincode, deviceLink.pincode!);
      factors.push(PSD2Factor.KNOWLEDGE);
      break;

    case ChallengeStrategy.BIOMETRY:
      await crypto.assert(biometry, deviceLink.biometry!);
      factors.push(PSD2Factor.INHERENCE);
      break;

    default:
      throw new ClientError("Invalid strategy", {
        debug: { strategy },
      });
  }

  if (metadata.device.name && metadata.device.name !== deviceLink.name) {
    deviceLink.name = metadata.device.name;

    await deviceLinkRepository.update(deviceLink);
  }

  const { token: challengeConfirmationToken, expiresIn } = jwt.sign<
    Record<string, unknown>,
    ChallengeConfirmationTokenClaims
  >({
    audiences: flatten([configuration.oauth.client_id, challengeSession.audiences]),
    claims: {
      deviceLinkId: deviceLink.id,
      factors,
      strategy,
    },
    expiry: configuration.defaults.challenge_confirmation_token_expiry,
    nonce: challengeSession.nonce,
    payload: challengeSession.payload,
    scopes: challengeSession.scopes,
    session: challengeSession.id,
    sessionHint: "challenge",
    subject: deviceLink.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: DeviceTokenType.CHALLENGE_CONFIRMATION,
  });

  await challengeSessionCache.destroy(challengeSession);

  return { body: { challengeConfirmationToken, expiresIn } };
};
