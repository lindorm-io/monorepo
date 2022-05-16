import { ServerKoaContext } from "../../types";
import { GetUserinfoResponseBody, IdentityServiceClaims, Scope } from "../../common";
import { Identity } from "../../entity";
import { getAddress, getDisplayName, getName } from "../../util";
import { getConnectedProviders } from "../external";
import { getUnixTime } from "date-fns";
import { includes } from "lodash";
import { userinfoEmailGet } from "../email";
import { userinfoPhoneNumberGet } from "../phone-number";

export const getUserinfoResponseBody = async (
  ctx: ServerKoaContext,
  identity: Identity,
  scopes: Array<string>,
): Promise<GetUserinfoResponseBody> => {
  const claims: Partial<IdentityServiceClaims> = {
    sub: identity.id,
    updatedAt: getUnixTime(identity.updated),
  };

  if (!includes(scopes, Scope.OPENID)) {
    return {
      active: identity.active,
      claims,
      permissions: identity.permissions,
    };
  }

  let email: string;
  let emailVerified: boolean;
  let phoneNumber: string;
  let phoneNumberVerified: boolean;

  for (const scope of scopes.sort()) {
    switch (scope) {
      case Scope.ACCESSIBILITY:
        claims.preferredAccessibility = identity.preferredAccessibility;
        break;

      case Scope.ADDRESS:
        claims.address = getAddress(identity);
        break;

      case Scope.CONNECTED_PROVIDERS:
        claims.connectedProviders = await getConnectedProviders(ctx, identity.id);
        break;

      case Scope.EMAIL:
        ({ email, emailVerified } = await userinfoEmailGet(ctx, identity.id));
        claims.email = email;
        claims.emailVerified = emailVerified;
        break;

      case Scope.NATIONAL_IDENTITY_NUMBER:
        claims.nationalIdentityNumber = identity.nationalIdentityNumber;
        break;

      case Scope.PHONE:
        ({ phoneNumber, phoneNumberVerified } = await userinfoPhoneNumberGet(ctx, identity.id));
        claims.phoneNumber = phoneNumber;
        claims.phoneNumberVerified = phoneNumberVerified;
        break;

      case Scope.PROFILE:
        claims.birthDate = identity.birthDate;
        claims.displayName = getDisplayName(identity);
        claims.familyName = identity.familyName;
        claims.gender = identity.gender;
        claims.givenName = identity.givenName;
        claims.gravatarUri = identity.gravatarUri;
        claims.locale = identity.locale;
        claims.middleName = identity.middleName;
        claims.name = getName(identity);
        claims.nickname = identity.nickname;
        claims.picture = identity.picture;
        claims.preferredUsername = identity.preferredUsername;
        claims.profile = identity.profile;
        claims.pronouns = identity.pronouns;
        claims.website = identity.website;
        claims.zoneInfo = identity.zoneInfo;
        break;

      case Scope.SOCIAL_SECURITY_NUMBER:
        claims.socialSecurityNumber = identity.socialSecurityNumber;
        break;

      case Scope.USERNAME:
        claims.username = identity.username;
        break;

      default:
        break;
    }
  }

  return {
    active: identity.active,
    claims,
    permissions: identity.permissions,
  };
};
