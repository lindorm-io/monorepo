import Joi from "joi";
import { ChallengeSession } from "../../entity";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, JOI_NONCE, ChallengeStrategy, SubjectHint, TokenType } from "../../common";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { getRandomString, stringToSeconds } from "@lindorm-io/core";
import { sortedUniq } from "lodash";

interface RequestData {
  clientId: string;
  deviceLinkId: string;
  identityId: string;
  nonce: string;
  payload: Record<string, any>;
  scopes: Array<string>;
}

interface ResponseBody {
  certificateChallenge: string;
  challengeSessionToken: string;
  expiresIn: number;
  strategies: Array<ChallengeStrategy>;
}

export const initialiseChallengeSchema = Joi.object<RequestData>()
  .keys({
    clientId: JOI_GUID.required(),
    deviceLinkId: JOI_GUID.required(),
    identityId: JOI_GUID.required(),
    nonce: JOI_NONCE.required(),
    payload: Joi.object().required(),
    scopes: Joi.array().items(Joi.string()).required(),
  })
  .required();

export const initialiseChallengeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { challengeSessionCache },
    data: { clientId, nonce, payload, scopes },
    entity: { deviceLink },
    jwt,
    metadata: { client },
  } = ctx;

  const strategies: Array<ChallengeStrategy> = [ChallengeStrategy.IMPLICIT];

  if (deviceLink.biometry) {
    strategies.push(ChallengeStrategy.BIOMETRY);
  }

  if (deviceLink.pincode) {
    strategies.push(ChallengeStrategy.PINCODE);
  }

  const certificateChallenge = getRandomString(128);
  const expiresIn = stringToSeconds(configuration.defaults.challenge_session_expiry);

  const session = await challengeSessionCache.create(
    new ChallengeSession({
      certificateChallenge,
      clientId,
      deviceLinkId: deviceLink.id,
      nonce,
      payload,
      scopes,
      strategies,
    }),
    expiresIn,
  );

  const { token } = jwt.sign({
    audiences: [client.id],
    expiry: configuration.defaults.challenge_session_expiry,
    sessionId: session.id,
    subject: deviceLink.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE_SESSION,
  });

  return {
    body: {
      certificateChallenge,
      challengeSessionToken: token,
      expiresIn,
      strategies: sortedUniq(strategies),
    },
  };
};
