import { ControllerResponse } from "@lindorm-io/koa";
import { LindormClaims, LindormScopes, GetUserinfoResponse } from "@lindorm-io/common-types";
import { ServerKoaController } from "../../types";
import { getAddress, getDisplayName, getName } from "../../util";
import { getIdentifierUserinfo } from "../../handler";
import { getUnixTime } from "date-fns";

export const getUserinfoController: ServerKoaController = async (
  ctx,
): ControllerResponse<GetUserinfoResponse> => {
  const {
    entity: { identity },
    repository: { addressRepository },
    token: {
      bearerToken: { scopes },
    },
  } = ctx;

  const claims: Partial<LindormClaims> = {
    active: identity.active,
    sub: identity.id,
    updatedAt: getUnixTime(identity.updated),
  };

  if (!scopes.includes(LindormScopes.OPENID)) {
    return { body: claims };
  }

  const primaryAddress = await addressRepository.tryFind({
    identityId: identity.id,
    primary: true,
  });

  const identifierUserinfo = await getIdentifierUserinfo(ctx, identity);

  for (const scope of scopes.sort()) {
    switch (scope) {
      case LindormScopes.ACCESSIBILITY:
        claims.preferredAccessibility = identity.preferredAccessibility;
        break;

      case LindormScopes.ADDRESS:
        claims.address = getAddress(primaryAddress);
        break;

      case LindormScopes.CONNECTED_PROVIDERS:
        claims.connectedProviders = identifierUserinfo.connectedProviders;
        break;

      case LindormScopes.EMAIL:
        claims.email = identifierUserinfo.email;
        claims.emailVerified = identifierUserinfo.emailVerified;
        break;

      case LindormScopes.NATIONAL_IDENTITY_NUMBER:
        claims.nationalIdentityNumber = identity.nationalIdentityNumber;
        claims.nationalIdentityNumberVerified = identity.nationalIdentityNumberVerified;
        break;

      case LindormScopes.PHONE:
        claims.phoneNumber = identifierUserinfo.phoneNumber;
        claims.phoneNumberVerified = identifierUserinfo.phoneNumberVerified;
        break;

      case LindormScopes.PROFILE:
        claims.birthDate = identity.birthDate;
        claims.familyName = identity.familyName;
        claims.gender = identity.gender;
        claims.givenName = identity.givenName;
        claims.locale = identity.locale;
        claims.middleName = identity.middleName;
        claims.name = getName(identity);
        claims.nickname = identity.nickname;
        claims.picture = identity.picture;
        claims.preferredUsername = identity.preferredUsername;
        claims.profile = identity.profile;
        claims.website = identity.website;
        claims.zoneInfo = identity.zoneInfo;
        break;

      case LindormScopes.PUBLIC:
        claims.displayName = getDisplayName(identity);
        claims.gravatarUri = identity.gravatarUri;
        claims.pronouns = identity.pronouns;
        break;

      case LindormScopes.SOCIAL_SECURITY_NUMBER:
        claims.socialSecurityNumber = identity.socialSecurityNumber;
        claims.socialSecurityNumberVerified = identity.socialSecurityNumberVerified;
        break;

      case LindormScopes.USERNAME:
        claims.username = identity.username;
        break;

      default:
        break;
    }
  }

  return { body: claims };
};
