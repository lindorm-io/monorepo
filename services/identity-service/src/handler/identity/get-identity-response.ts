import { GetIdentityResponse, IdentifierType } from "@lindorm-io/common-types";
import { Identity } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getDisplayName } from "../../util";

export const getIdentityResponse = async (
  ctx: ServerKoaContext,
  identity: Identity,
): Promise<GetIdentityResponse> => {
  const {
    mongo: { addressRepository, identifierRepository },
  } = ctx;

  const addresses = await addressRepository.findMany({ identityId: identity.id });
  const identifiers = await identifierRepository.findMany({ identityId: identity.id });

  return {
    addresses: addresses.map((x) => ({
      careOf: x.careOf,
      country: x.country,
      label: x.label,
      locality: x.locality,
      postalCode: x.postalCode,
      primary: x.primary,
      region: x.region,
      streetAddress: x.streetAddress,
    })),

    connectedProviders: identifiers
      .filter((x) => x.type === IdentifierType.EXTERNAL)
      .map((x) => x.provider),

    emails: identifiers
      .filter((x) => x.type === IdentifierType.EMAIL)
      .map((x) => ({
        email: x.value,
        label: x.label,
        primary: x.primary,
        verified: x.verified,
      })),

    nationalIdentityNumbers: identifiers
      .filter((x) => x.type === IdentifierType.NIN)
      .map((x) => ({
        nin: x.value,
        label: x.label,
        primary: x.primary,
        provider: x.provider,
        verified: x.verified,
      })),

    phoneNumbers: identifiers
      .filter((x) => x.type === IdentifierType.PHONE)
      .map((x) => ({
        phoneNumber: x.value,
        label: x.label,
        primary: x.primary,
        verified: x.verified,
      })),

    socialSecurityNumbers: identifiers
      .filter((x) => x.type === IdentifierType.NIN)
      .map((x) => ({
        ssn: x.value,
        label: x.label,
        primary: x.primary,
        provider: x.provider,
        verified: x.verified,
      })),

    active: identity.active,
    birthDate: identity.birthDate,
    displayName: getDisplayName(identity),
    familyName: identity.familyName,
    gender: identity.gender,
    givenName: identity.givenName,
    avatarUri: identity.avatarUri,
    locale: identity.locale,
    middleName: identity.middleName,
    namingSystem: identity.namingSystem,
    nickname: identity.nickname,
    picture: identity.picture,
    preferredAccessibility: identity.preferredAccessibility,
    preferredUsername: identity.preferredUsername,
    profile: identity.profile,
    pronouns: identity.pronouns,
    takenName: identity.takenName,
    username: identity.username,
    website: identity.website,
    zoneInfo: identity.zoneInfo,
  };
};
