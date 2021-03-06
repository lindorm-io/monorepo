import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_LOCALE, Scope } from "../../common";
import { NamingSystem } from "../../enum";
import { ServerKoaController, IdentityAddress } from "../../types";
import { isUndefined } from "lodash";
import { updateIdentityDisplayName } from "../../handler";
import {
  JOI_BIRTHDATE,
  JOI_IDENTITY_ADDRESS,
  JOI_IDENTITY_DISPLAY_NAME,
  JOI_NAMING_SYSTEM,
  JOI_ZONE_INFO,
} from "../../constant";

interface RequestData {
  address: IdentityAddress;
  birthDate: string;
  displayName: string;
  familyName: string;
  gender: string;
  givenName: string;
  gravatarUri: string;
  locale: string;
  middleName: string;
  namingSystem: NamingSystem;
  nationalIdentityNumber: string;
  nickname: string;
  picture: string;
  preferredAccessibility: Array<string>;
  profile: string;
  pronouns: string;
  socialSecurityNumber: string;
  username: string;
  website: string;
  zoneInfo: string;
}

export const updateIdentitySchema = Joi.object<RequestData>()
  .keys({
    address: JOI_IDENTITY_ADDRESS.optional(),
    birthDate: JOI_BIRTHDATE.allow(null).optional(),
    displayName: JOI_IDENTITY_DISPLAY_NAME.optional(),
    familyName: Joi.string().allow(null).optional(),
    gender: Joi.string().allow(null).optional(),
    givenName: Joi.string().allow(null).optional(),
    gravatarUri: Joi.string().uri().allow(null).optional(),
    locale: JOI_LOCALE.allow(null).optional(),
    middleName: Joi.string().allow(null).optional(),
    namingSystem: JOI_NAMING_SYSTEM.optional(),
    nationalIdentityNumber: Joi.string().allow(null).optional(),
    nickname: Joi.string().allow(null).optional(),
    picture: Joi.string().uri().allow(null).optional(),
    preferredAccessibility: Joi.array().items(Joi.string()).optional(),
    profile: Joi.string().uri().allow(null).optional(),
    pronouns: Joi.string().allow(null).optional(),
    socialSecurityNumber: Joi.string().allow(null).optional(),
    username: Joi.string().lowercase().allow(null).optional(),
    website: Joi.string().uri().allow(null).optional(),
    zoneInfo: JOI_ZONE_INFO.allow(null).optional(),
  })
  .required();

export const updateIdentityController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: {
      birthDate,
      displayName,
      familyName,
      gender,
      givenName,
      gravatarUri,
      locale,
      middleName,
      namingSystem,
      nationalIdentityNumber,
      nickname,
      picture,
      preferredAccessibility,
      profile,
      pronouns,
      socialSecurityNumber,
      username,
      website,
      zoneInfo,
    },
    entity: { identity },
    repository: { identityRepository },
    token: {
      bearerToken: { scopes },
    },
  } = ctx;

  if (scopes.includes(Scope.ACCESSIBILITY) && !isUndefined(preferredAccessibility)) {
    identity.preferredAccessibility = preferredAccessibility;
  }

  if (scopes.includes(Scope.NATIONAL_IDENTITY_NUMBER) && !isUndefined(nationalIdentityNumber)) {
    identity.nationalIdentityNumber = nationalIdentityNumber;
  }

  if (scopes.includes(Scope.PROFILE)) {
    if (!isUndefined(displayName) && displayName !== identity.displayName.name) {
      await updateIdentityDisplayName(ctx, identity, displayName);
    }
    if (!isUndefined(birthDate)) identity.birthDate = birthDate;
    if (!isUndefined(familyName)) identity.familyName = familyName;
    if (!isUndefined(gender)) identity.gender = gender;
    if (!isUndefined(givenName)) identity.givenName = givenName;
    if (!isUndefined(gravatarUri)) identity.gravatarUri = gravatarUri;
    if (!isUndefined(locale)) identity.locale = locale;
    if (!isUndefined(middleName)) identity.middleName = middleName;
    if (!isUndefined(namingSystem)) identity.namingSystem = namingSystem;
    if (!isUndefined(nickname)) identity.nickname = nickname;
    if (!isUndefined(picture)) identity.picture = picture;
    if (!isUndefined(profile)) identity.profile = profile;
    if (!isUndefined(pronouns)) identity.pronouns = pronouns;
    if (!isUndefined(website)) identity.website = website;
    if (!isUndefined(zoneInfo)) identity.zoneInfo = zoneInfo;
  }

  if (scopes.includes(Scope.SOCIAL_SECURITY_NUMBER) && !isUndefined(socialSecurityNumber)) {
    identity.socialSecurityNumber = socialSecurityNumber;
  }

  if (scopes.includes(Scope.USERNAME) && !isUndefined(username)) {
    identity.preferredUsername = username;
    identity.username = username;
  }

  await identityRepository.update(identity);
};
