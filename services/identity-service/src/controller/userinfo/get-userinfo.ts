import {
  GetUserinfoResponse,
  LindormClaims,
  LindormScope,
  OpenIdScope,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import { getUnixTime } from "date-fns";
import { getIdentifierClaims } from "../../handler";
import { ServerKoaController } from "../../types";
import { getAddress, getDisplayName, getName } from "../../util";

type ResponseData = GetUserinfoResponse;

export const getUserinfoController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseData> => {
  const {
    entity: { identity },
    mongo: { addressRepository },
    token: {
      bearerToken: { scopes },
    },
  } = ctx;

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

  const identifierUserinfo = await getIdentifierClaims(ctx, identity);

  for (const scope of scopes.sort()) {
    switch (scope) {
      case OpenIdScope.ADDRESS:
        claims.address = getAddress(primaryAddress);
        break;

      case OpenIdScope.EMAIL:
        claims.email = identifierUserinfo.email;
        claims.emailVerified = identifierUserinfo.emailVerified;
        break;

      case OpenIdScope.PHONE:
        claims.phoneNumber = identifierUserinfo.phoneNumber;
        claims.phoneNumberVerified = identifierUserinfo.phoneNumberVerified;
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
        claims.nationalIdentityNumber = identifierUserinfo.nationalIdentityNumber;
        claims.nationalIdentityNumberVerified = identifierUserinfo.nationalIdentityNumberVerified;
        break;

      case LindormScope.PUBLIC:
        claims.displayName = getDisplayName(identity);
        claims.avatarUri = identity.avatarUri;
        claims.pronouns = identity.pronouns;
        break;

      case LindormScope.SOCIAL_SECURITY_NUMBER:
        claims.socialSecurityNumber = identifierUserinfo.socialSecurityNumber;
        claims.socialSecurityNumberVerified = identifierUserinfo.socialSecurityNumberVerified;
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
