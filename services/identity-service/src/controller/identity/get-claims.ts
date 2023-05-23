import {
  GetClaimsQuery,
  GetClaimsResponse,
  LindormClaims,
  LindormScope,
  OpenIdScope,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import { getUnixTime } from "date-fns";
import Joi from "joi";
import { getIdentifierClaims, getOauthClaimsRequest } from "../../handler";
import { ServerKoaController } from "../../types";
import { getAddress, getDisplayName, getName } from "../../util";

type ResponseData = GetClaimsResponse;

export const getClaimsSchema = Joi.object<GetClaimsQuery>()
  .keys({
    session: Joi.string().guid().required(),
  })
  .required();

export const getClaimsController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseData> => {
  const {
    data: { session },
    mongo: { addressRepository, identityRepository },
  } = ctx;

  const {
    claimsRequest: { identityId, scopes },
  } = await getOauthClaimsRequest(ctx, session);

  const identity = await identityRepository.find({ id: identityId });

  const claims: Partial<LindormClaims> = {
    active: identity.active,
    sub: identity.id,
    updatedAt: getUnixTime(identity.updated),
  };

  if (!scopes.includes(OpenIdScope.OPENID)) {
    return { body: claims };
  }

  const primaryAddress = await addressRepository.tryFind({
    identityId: identity.id,
    primary: true,
  });

  const identifierClaims = await getIdentifierClaims(ctx, identity);

  for (const scope of scopes.sort()) {
    switch (scope) {
      case OpenIdScope.ADDRESS:
        claims.address = getAddress(primaryAddress);
        break;

      case OpenIdScope.EMAIL:
        claims.email = identifierClaims.email;
        claims.emailVerified = identifierClaims.emailVerified;
        break;

      case OpenIdScope.PHONE:
        claims.phoneNumber = identifierClaims.phoneNumber;
        claims.phoneNumberVerified = identifierClaims.phoneNumberVerified;
        break;

      case OpenIdScope.PROFILE:
        claims.birthDate = identity.birthDate;
        claims.familyName = identity.familyName;
        claims.gender = identity.gender;
        claims.givenName = identity.givenName;
        claims.locale = identity.locale;
        claims.maritalStatus = identity.maritalStatus;
        claims.middleName = identity.middleName;
        claims.name = getName(identity);
        claims.nickname = identity.nickname;
        claims.picture = identity.picture;
        claims.preferredUsername = identity.preferredUsername;
        claims.profile = identity.profile;
        claims.preferredName = identity.preferredName;
        claims.website = identity.website;
        claims.zoneInfo = identity.zoneInfo;
        break;

      case LindormScope.ACCESSIBILITY:
        claims.preferredAccessibility = identity.preferredAccessibility;
        break;

      case LindormScope.NATIONAL_IDENTITY_NUMBER:
        claims.nationalIdentityNumber = identifierClaims.nationalIdentityNumber;
        claims.nationalIdentityNumberVerified = identifierClaims.nationalIdentityNumberVerified;
        break;

      case LindormScope.PUBLIC:
        claims.avatarUri = identity.avatarUri;
        claims.displayName = getDisplayName(identity);
        claims.pronouns = identity.pronouns;
        break;

      case LindormScope.SOCIAL_SECURITY_NUMBER:
        claims.socialSecurityNumber = identifierClaims.socialSecurityNumber;
        claims.socialSecurityNumberVerified = identifierClaims.socialSecurityNumberVerified;
        break;

      case LindormScope.USERNAME:
        claims.username = identity.username;
        break;

      default:
        break;
    }
  }

  return { body: claims };
};
