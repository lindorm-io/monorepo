import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_BIRTHDATE, JOI_OPENID_ADDRESS, JOI_ZONE_INFO } from "../../constant";
import {
  AddUserinfoRequestBody,
  JOI_EMAIL,
  JOI_GUID,
  JOI_LOCALE,
  JOI_PHONE_NUMBER,
} from "../../common";
import {
  userinfoEmailAdd,
  userinfoExternalIdentifierAdd,
  userinfoPhoneNumberAdd,
  userinfoUsernameAdd,
} from "../../handler";

interface RequestData extends AddUserinfoRequestBody {
  id: string;
}

export const addUserinfoSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),

  provider: Joi.string().uri().required(),
  sub: Joi.string().required(),
  updatedAt: Joi.number().required(),

  address: JOI_OPENID_ADDRESS.optional(),
  birthDate: JOI_BIRTHDATE.optional(),
  email: JOI_EMAIL.optional(),
  emailVerified: Joi.boolean().optional(),
  familyName: Joi.string().optional(),
  gender: Joi.string().optional(),
  givenName: Joi.string().optional(),
  locale: JOI_LOCALE.optional(),
  middleName: Joi.string().optional(),
  nickname: Joi.string().optional(),
  phoneNumber: JOI_PHONE_NUMBER.optional(),
  phoneNumberVerified: Joi.boolean().optional(),
  picture: Joi.string().uri().optional(),
  preferredUsername: Joi.string().optional(),
  profile: Joi.string().uri().optional(),
  website: Joi.string().uri().optional(),
  zoneInfo: JOI_ZONE_INFO.optional(),
});

export const addUserinfoController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: {
      address,
      birthDate,
      email,
      familyName,
      gender,
      givenName,
      locale,
      middleName,
      nickname,
      phoneNumber,
      picture,
      preferredUsername,
      profile,
      provider,
      sub,
      website,
      zoneInfo,
    },
    entity: { identity },
    repository: { identityRepository },
  } = ctx;

  const { id: identityId } = identity;

  identity.address = {
    careOf: identity.address.careOf || null,
    country: identity.address.country || address?.country,
    locality: identity.address.locality || address?.locality,
    postalCode: identity.address.postalCode || address?.postalCode,
    region: identity.address.region || address?.region,
    streetAddress: identity.address.streetAddress.length
      ? identity.address.streetAddress
      : address?.streetAddress.split("\n"),
  };
  identity.birthDate = identity.birthDate || birthDate;
  identity.familyName = identity.familyName || familyName;
  identity.gender = identity.gender || gender;
  identity.givenName = identity.givenName || givenName;
  identity.locale = identity.locale || locale;
  identity.middleName = identity.middleName || middleName;
  identity.nickname = identity.nickname || nickname;
  identity.picture = identity.picture || picture;
  identity.profile = identity.profile || profile;
  identity.preferredUsername = identity.preferredUsername || preferredUsername;
  identity.website = identity.website || website;
  identity.zoneInfo = identity.zoneInfo || zoneInfo;

  await identityRepository.update(identity);

  if (email) {
    await userinfoEmailAdd(ctx, {
      identityId,
      email,
    });
  }

  if (phoneNumber) {
    await userinfoPhoneNumberAdd(ctx, {
      identityId,
      phoneNumber,
    });
  }

  await userinfoExternalIdentifierAdd(ctx, {
    identityId,
    identifier: sub,
    provider,
  });

  await userinfoUsernameAdd(ctx, identity);

  return {};
};
