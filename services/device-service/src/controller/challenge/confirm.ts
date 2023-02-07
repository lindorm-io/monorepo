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
  ChallengeStrategies,
  ConfirmChallengeRequestBody,
  ConfirmChallengeRequestParams,
  ConfirmChallengeResponse,
  LindormTokenTypes,
  PSD2Factor,
  PSD2Factors,
  SubjectHints,
} from "@lindorm-io/common-types";

type RequestData = ConfirmChallengeRequestParams & ConfirmChallengeRequestBody;

type ResponseBody = ConfirmChallengeResponse;

export const confirmChallengeSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    biometry: Joi.when("strategy", {
      is: ChallengeStrategies.BIOMETRY,
      then: JOI_BIOMETRY.required(),
      otherwise: Joi.forbidden(),
    }),
    certificateVerifier: Joi.string().base64().required(),
    challengeSessionToken: JOI_JWT.required(),
    pincode: Joi.when("strategy", {
      is: ChallengeStrategies.PINCODE,
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
    metadata: {
      device: { name },
    },
    repository: { deviceLinkRepository },
  } = ctx;

  await assertCertificateChallenge({
    certificateChallenge: challengeSession.certificateChallenge,
    certificateMethod: deviceLink.certificateMethod,
    certificateVerifier,
    publicKey: deviceLink.publicKey,
  });

  const factors: Array<PSD2Factor> = [PSD2Factors.POSSESSION];

  const salt = await vaultGetSalt(ctx, deviceLink);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  switch (strategy) {
    case ChallengeStrategies.IMPLICIT:
      break;

    case ChallengeStrategies.PINCODE:
      await crypto.assert(pincode, deviceLink.pincode);
      factors.push(PSD2Factors.KNOWLEDGE);
      break;

    case ChallengeStrategies.BIOMETRY:
      await crypto.assert(biometry, deviceLink.biometry);
      factors.push(PSD2Factors.INHERENCE);
      break;

    default:
      throw new ClientError("Invalid strategy", {
        debug: { strategy },
      });
  }

  if (name && name !== deviceLink.name) {
    deviceLink.name = name;

    await deviceLinkRepository.update(deviceLink);
  }

  const { expiresIn, token } = jwt.sign<Record<string, unknown>, ChallengeConfirmationTokenClaims>({
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
    sessionId: challengeSession.id,
    subject: deviceLink.identityId,
    subjectHint: SubjectHints.IDENTITY,
    type: LindormTokenTypes.CHALLENGE_CONFIRMATION,
  });

  await challengeSessionCache.destroy(challengeSession);

  return { body: { challengeConfirmationToken: token, expiresIn } };
};
