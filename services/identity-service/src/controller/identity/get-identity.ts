import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { IdentifierType, Scope } from "../../common";
import { ServerKoaController } from "../../types";
import {
  getAddressList,
  getDisplayName,
  getIdentifiersList,
  getListOfConnectedProviders,
  getName,
} from "../../util";

export const getIdentityController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    entity: { identity },
    repository: { addressRepository, identifierRepository },
    token: {
      bearerToken: { scopes },
    },
  } = ctx;

  const body: Record<string, any> = {
    active: identity.active,
    permissions: identity.permissions,
  };

  if (!scopes.includes(Scope.OPENID)) {
    throw new ClientError("Unauthorized", {
      debug: { scopes },
      description: "Invalid scope",
    });
  }

  const addresses = await addressRepository.findMany({ identityId: identity.id });
  const identifiers = await identifierRepository.findMany({ identityId: identity.id });

  for (const scope of scopes.sort()) {
    switch (scope) {
      case Scope.ACCESSIBILITY:
        body.preferredAccessibility = identity.preferredAccessibility;
        break;

      case Scope.ADDRESS:
        body.addresses = getAddressList(addresses);
        break;

      case Scope.CONNECTED_PROVIDERS:
        body.connectedProviders = getListOfConnectedProviders(identifiers);
        break;

      case Scope.EMAIL:
        body.emails = getIdentifiersList(identifiers, IdentifierType.EMAIL);
        break;

      case Scope.NATIONAL_IDENTITY_NUMBER:
        body.nationalIdentityNumber = identity.nationalIdentityNumber;
        body.nationalIdentityNumberVerified = identity.nationalIdentityNumberVerified;
        break;

      case Scope.PHONE:
        body.phoneNumbers = getIdentifiersList(identifiers, IdentifierType.PHONE);
        break;

      case Scope.PROFILE:
        body.birthDate = identity.birthDate;
        body.displayName = getDisplayName(identity);
        body.familyName = identity.familyName;
        body.gender = identity.gender;
        body.givenName = identity.givenName;
        body.gravatarUri = identity.gravatarUri;
        body.locale = identity.locale;
        body.middleName = identity.middleName;
        body.name = getName(identity);
        body.nickname = identity.nickname;
        body.picture = identity.picture;
        body.preferredUsername = identity.preferredUsername;
        body.profile = identity.profile;
        body.pronouns = identity.pronouns;
        body.website = identity.website;
        body.zoneInfo = identity.zoneInfo;
        break;

      case Scope.SOCIAL_SECURITY_NUMBER:
        body.socialSecurityNumber = identity.socialSecurityNumber;
        body.socialSecurityNumberVerified = identity.socialSecurityNumberVerified;
        break;

      case Scope.USERNAME:
        body.username = identity.username;
        break;

      default:
        break;
    }
  }

  return { body };
};
