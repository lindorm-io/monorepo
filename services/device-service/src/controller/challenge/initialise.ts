import { ChallengeStrategy, SubjectHint, TokenType } from "@lindorm-io/common-enums";
import {
  InitialiseChallengeRequestBody,
  InitialiseChallengeResponse,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { expiryDate } from "@lindorm-io/expiry";
import { ControllerResponse } from "@lindorm-io/koa";
import { randomString } from "@lindorm-io/random";
import Joi from "joi";
import { sortedUniq } from "lodash";
import { JOI_NONCE } from "../../common";
import { ChallengeSession } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";

type RequestData = InitialiseChallengeRequestBody;

type ResponseBody = InitialiseChallengeResponse;

export const initialiseChallengeSchema = Joi.object<RequestData>()
  .keys({
    audiences: Joi.array().items(Joi.string().guid()).optional(),
    deviceLinkId: Joi.string().guid().required(),
    identityId: Joi.string().guid().required(),
    nonce: JOI_NONCE.required(),
    payload: Joi.object().required(),
    scopes: Joi.array().items(Joi.string()).required(),
  })
  .required();

export const initialiseChallengeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { challengeSessionCache },
    data: { audiences, identityId, nonce, payload, scopes },
    entity: { deviceLink },
    jwt,
    metadata,
  } = ctx;

  if (!deviceLink.active) {
    throw new ClientError("Inactive device");
  }

  if (!deviceLink.trusted) {
    throw new ClientError("Untrusted device");
  }

  if (
    deviceLink.id !== metadata.device.linkId ||
    deviceLink.installationId !== metadata.device.installationId ||
    deviceLink.uniqueId !== metadata.device.uniqueId
  ) {
    throw new ClientError("Invalid metadata");
  }

  if (deviceLink.identityId !== identityId) {
    throw new ClientError("Invalid identity");
  }

  const strategies: Array<ChallengeStrategy> = [ChallengeStrategy.IMPLICIT];

  if (deviceLink.biometry) {
    strategies.push(ChallengeStrategy.BIOMETRY);
  }

  if (deviceLink.pincode) {
    strategies.push(ChallengeStrategy.PINCODE);
  }

  const certificateChallenge = randomString(128);

  const challengeSession = await challengeSessionCache.create(
    new ChallengeSession({
      certificateChallenge,
      audiences,
      deviceLinkId: deviceLink.id,
      expires: expiryDate(configuration.defaults.challenge_session_expiry),
      nonce,
      payload,
      scopes,
      strategies,
    }),
  );

  const { token } = jwt.sign({
    audiences: [configuration.oauth.client_id],
    expiry: configuration.defaults.challenge_session_expiry,
    session: challengeSession.id,
    sessionHint: "challenge",
    subject: deviceLink.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE,
  });

  return {
    body: {
      certificateChallenge,
      challengeSessionId: challengeSession.id,
      challengeSessionToken: token,
      expires: challengeSession.expires.toISOString(),
      strategies: sortedUniq(strategies),
    },
  };
};
