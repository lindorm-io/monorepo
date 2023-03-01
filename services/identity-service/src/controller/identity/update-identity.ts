import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_LOCALE } from "../../common";
import { ServerKoaController } from "../../types";
import { UpdateIdentityRequestBody, UpdateIdentityRequestParams } from "@lindorm-io/common-types";
import { updateIdentityDisplayName } from "../../handler";
import {
  JOI_BIRTHDATE,
  JOI_DISPLAY_NAME_STRING,
  JOI_NAMING_SYSTEM,
  JOI_ZONE_INFO,
} from "../../constant";

type RequestData = UpdateIdentityRequestParams & UpdateIdentityRequestBody;

export const updateIdentitySchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    active: Joi.boolean(),
    birthDate: JOI_BIRTHDATE.allow(null),
    displayName: JOI_DISPLAY_NAME_STRING,
    familyName: Joi.string().allow(null),
    gender: Joi.string().allow(null),
    givenName: Joi.string().allow(null),
    avatarUri: Joi.string().uri().allow(null),
    locale: JOI_LOCALE.allow(null),
    middleName: Joi.string().allow(null),
    namingSystem: JOI_NAMING_SYSTEM,
    nickname: Joi.string().allow(null),
    picture: Joi.string().uri().allow(null),
    preferredAccessibility: Joi.array().items(Joi.string()),
    profile: Joi.string().uri().allow(null),
    pronouns: Joi.string().allow(null),
    takenName: Joi.string().allow(null),
    website: Joi.string().uri().allow(null),
    zoneInfo: JOI_ZONE_INFO.allow(null),
  })
  .options({ abortEarly: false })
  .required();

export const updateIdentityController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: {
      active,
      birthDate,
      displayName,
      familyName,
      gender,
      givenName,
      avatarUri,
      locale,
      middleName,
      namingSystem,
      nickname,
      picture,
      preferredAccessibility,
      profile,
      pronouns,
      takenName,
      website,
      zoneInfo,
    },
    entity: { identity },
    repository: { identityRepository },
  } = ctx;

  if (active !== undefined) {
    identity.active = active;
  }

  if (birthDate !== undefined) {
    identity.birthDate = birthDate;
  }

  if (
    displayName !== undefined &&
    displayName !== null &&
    displayName !== identity.displayName.name
  ) {
    await updateIdentityDisplayName(ctx, identity, displayName);
  }

  if (familyName !== undefined) {
    identity.familyName = familyName;
  }

  if (gender !== undefined) {
    identity.gender = gender;
  }

  if (givenName !== undefined) {
    identity.givenName = givenName;
  }

  if (avatarUri !== undefined) {
    identity.avatarUri = avatarUri;
  }

  if (locale !== undefined) {
    identity.locale = locale;
  }

  if (middleName !== undefined) {
    identity.middleName = middleName;
  }

  if (namingSystem !== undefined) {
    identity.namingSystem = namingSystem;
  }

  if (nickname !== undefined) {
    identity.nickname = nickname;
  }

  if (picture !== undefined) {
    identity.picture = picture;
  }

  if (preferredAccessibility !== undefined) {
    identity.preferredAccessibility = preferredAccessibility;
  }

  if (profile !== undefined) {
    identity.profile = profile;
  }

  if (pronouns !== undefined) {
    identity.pronouns = pronouns;
  }

  if (takenName !== undefined) {
    identity.takenName = takenName;
  }

  if (website !== undefined) {
    identity.website = website;
  }

  if (zoneInfo !== undefined) {
    identity.zoneInfo = zoneInfo;
  }

  await identityRepository.update(identity);
};
