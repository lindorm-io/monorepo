import { IdentifierType } from "@lindorm-io/common-enums";
import { AddUserinfoRequestBody, AddUserinfoRequestParams } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_EMAIL, JOI_LOCALE, JOI_PHONE_NUMBER } from "../../common";
import { JOI_BIRTHDATE, JOI_OPENID_ADDRESS, JOI_ZONE_INFO } from "../../constant";
import { addAddressFromUserinfo, addGenericIdentifier } from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = AddUserinfoRequestParams & AddUserinfoRequestBody;

export const addUserinfoSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),

    provider: Joi.string().uri().required(),
    sub: Joi.string().required(),
    updatedAt: Joi.number().required(),

    address: JOI_OPENID_ADDRESS,
    birthDate: JOI_BIRTHDATE,
    email: JOI_EMAIL,
    emailVerified: Joi.boolean(),
    familyName: Joi.string(),
    gender: Joi.string(),
    givenName: Joi.string(),
    locale: JOI_LOCALE,
    middleName: Joi.string(),
    nickname: Joi.string(),
    phoneNumber: JOI_PHONE_NUMBER,
    phoneNumberVerified: Joi.boolean(),
    picture: Joi.string().uri(),
    preferredUsername: Joi.string(),
    profile: Joi.string().uri(),
    website: Joi.string().uri(),
    zoneInfo: JOI_ZONE_INFO,
  })
  .options({ abortEarly: false, allowUnknown: true })
  .required();

export const addUserinfoController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: {
      address,
      birthDate,
      email,
      emailVerified,
      familyName,
      gender,
      givenName,
      locale,
      middleName,
      nickname,
      phoneNumber,
      phoneNumberVerified,
      picture,
      preferredUsername,
      profile,
      provider,
      sub,
      website,
      zoneInfo,
    },
    entity: { identity },
    mongo: { identityRepository },
  } = ctx;

  identity.birthDate = identity.birthDate || birthDate || null;
  identity.familyName = identity.familyName || familyName || null;
  identity.gender = identity.gender || gender || null;
  identity.givenName = identity.givenName || givenName || null;
  identity.locale = identity.locale || locale || null;
  identity.middleName = identity.middleName || middleName || null;
  identity.nickname = identity.nickname || nickname || null;
  identity.picture = identity.picture || picture || null;
  identity.profile = identity.profile || profile || null;
  identity.website = identity.website || website || null;
  identity.zoneInfo = identity.zoneInfo || zoneInfo || null;

  const updated = await identityRepository.update(identity);

  if (preferredUsername && !identity.preferredUsername && !identity.username) {
    updated.preferredUsername = preferredUsername;
    updated.username = preferredUsername;

    try {
      await identityRepository.update(updated);
    } catch (_) {
      /* ignored */
    }
  }

  if (address) {
    await addAddressFromUserinfo(ctx, identity, address);
  }

  if (email && emailVerified) {
    await addGenericIdentifier(ctx, identity, {
      type: IdentifierType.EMAIL,
      value: email,
      verified: false,
    });
  }

  if (phoneNumber && phoneNumberVerified) {
    await addGenericIdentifier(ctx, identity, {
      type: IdentifierType.PHONE,
      value: phoneNumber,
      verified: false,
    });
  }

  await addGenericIdentifier(ctx, identity, {
    provider,
    type: IdentifierType.EXTERNAL,
    value: sub,
    verified: true,
  });
};
