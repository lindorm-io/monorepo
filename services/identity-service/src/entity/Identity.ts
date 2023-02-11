import Joi from "joi";
import { JOI_LOCALE } from "../common";
import { NamingSystem } from "../enum";
import {
  JOI_BIRTHDATE,
  JOI_IDENTITY_DISPLAY_NAME,
  JOI_NAMING_SYSTEM,
  JOI_ZONE_INFO,
} from "../constant";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export type IdentityDisplayName = {
  name: string | null;
  number: number | null;
};

export type IdentityAttributes = EntityAttributes & {
  active: boolean;
  birthDate: string | null;
  displayName: IdentityDisplayName;
  familyName: string | null;
  gender: string | null;
  givenName: string | null;
  gravatarUri: string | null;
  locale: string | null;
  middleName: string | null;
  namingSystem: string | null;
  nationalIdentityNumber: string | null;
  nationalIdentityNumberVerified: boolean;
  nickname: string | null;
  picture: string | null;
  preferredAccessibility: Array<string>;
  preferredUsername: string | null;
  profile: string | null;
  pronouns: string | null;
  socialSecurityNumber: string | null;
  socialSecurityNumberVerified: boolean;
  takenName: string | null;
  username: string | null;
  website: string | null;
  zoneInfo: string | null;
};

export type IdentityOptions = Optional<
  IdentityAttributes,
  | EntityKeys
  | "active"
  | "birthDate"
  | "displayName"
  | "familyName"
  | "gender"
  | "givenName"
  | "gravatarUri"
  | "locale"
  | "middleName"
  | "namingSystem"
  | "nationalIdentityNumber"
  | "nationalIdentityNumberVerified"
  | "nickname"
  | "picture"
  | "preferredAccessibility"
  | "preferredUsername"
  | "profile"
  | "pronouns"
  | "socialSecurityNumber"
  | "socialSecurityNumberVerified"
  | "takenName"
  | "username"
  | "website"
  | "zoneInfo"
>;

const schema = Joi.object<IdentityAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    active: Joi.boolean().required(),
    birthDate: JOI_BIRTHDATE.allow(null).required(),
    displayName: JOI_IDENTITY_DISPLAY_NAME.required(),
    familyName: Joi.string().allow(null).required(),
    gender: Joi.string().allow(null).required(),
    givenName: Joi.string().allow(null).required(),
    gravatarUri: Joi.string().uri().allow(null).required(),
    locale: JOI_LOCALE.allow(null).required(),
    middleName: Joi.string().allow(null).required(),
    namingSystem: JOI_NAMING_SYSTEM.required(),
    nationalIdentityNumber: Joi.string().allow(null).required(),
    nationalIdentityNumberVerified: Joi.boolean().required(),
    nickname: Joi.string().allow(null).required(),
    picture: Joi.string().uri().allow(null).required(),
    preferredAccessibility: Joi.array().items(Joi.string()).required(),
    preferredUsername: Joi.string().allow(null).required(),
    profile: Joi.string().uri().allow(null).required(),
    pronouns: Joi.string().allow(null).required(),
    socialSecurityNumber: Joi.string().allow(null).required(),
    socialSecurityNumberVerified: Joi.boolean().required(),
    takenName: Joi.string().allow(null).required(),
    username: Joi.string().lowercase().allow(null).required(),
    website: Joi.string().uri().allow(null).required(),
    zoneInfo: JOI_ZONE_INFO.allow(null).required(),
  })
  .required();

export class Identity extends LindormEntity<IdentityAttributes> {
  public active: boolean;
  public birthDate: string | null;
  public displayName: IdentityDisplayName;
  public familyName: string | null;
  public gender: string | null;
  public givenName: string | null;
  public gravatarUri: string | null;
  public locale: string | null;
  public middleName: string | null;
  public namingSystem: string | null;
  public nationalIdentityNumber: string | null;
  public nationalIdentityNumberVerified: boolean;
  public nickname: string | null;
  public picture: string | null;
  public preferredAccessibility: Array<string>;
  public preferredUsername: string | null;
  public profile: string | null;
  public pronouns: string | null;
  public socialSecurityNumber: string | null;
  public socialSecurityNumberVerified: boolean;
  public takenName: string | null;
  public username: string | null;
  public website: string | null;
  public zoneInfo: string | null;

  public constructor(options: IdentityOptions) {
    super(options);

    this.active = options.active !== false;
    this.birthDate = options.birthDate || null;
    this.displayName = {
      name: options.displayName?.name || null,
      number: options.displayName?.number || null,
    };
    this.familyName = options.familyName || null;
    this.gender = options.gender || null;
    this.givenName = options.givenName || null;
    this.gravatarUri = options.gravatarUri || null;
    this.locale = options.locale || null;
    this.middleName = options.middleName || null;
    this.namingSystem = options.namingSystem || NamingSystem.GIVEN_FAMILY;
    this.nationalIdentityNumber = options.nationalIdentityNumber || null;
    this.nationalIdentityNumberVerified = options.nationalIdentityNumberVerified === true;
    this.nickname = options.nickname || null;
    this.picture = options.picture || null;
    this.preferredAccessibility = options.preferredAccessibility || [];
    this.preferredUsername = options.preferredUsername || null;
    this.profile = options.profile || null;
    this.pronouns = options.pronouns || null;
    this.socialSecurityNumber = options.socialSecurityNumber || null;
    this.socialSecurityNumberVerified = options.socialSecurityNumberVerified === true;
    this.takenName = options.takenName || null;
    this.username = options.username || null;
    this.website = options.website || null;
    this.zoneInfo = options.zoneInfo || null;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): IdentityAttributes {
    return {
      ...this.defaultJSON(),

      active: this.active,
      birthDate: this.birthDate,
      displayName: this.displayName,
      familyName: this.familyName,
      gender: this.gender,
      givenName: this.givenName,
      gravatarUri: this.gravatarUri,
      locale: this.locale,
      middleName: this.middleName,
      namingSystem: this.namingSystem,
      nationalIdentityNumber: this.nationalIdentityNumber,
      nationalIdentityNumberVerified: this.nationalIdentityNumberVerified,
      nickname: this.nickname,
      picture: this.picture,
      preferredAccessibility: this.preferredAccessibility,
      preferredUsername: this.preferredUsername,
      profile: this.profile,
      pronouns: this.pronouns,
      socialSecurityNumber: this.socialSecurityNumber,
      socialSecurityNumberVerified: this.socialSecurityNumberVerified,
      takenName: this.takenName,
      username: this.username,
      website: this.website,
      zoneInfo: this.zoneInfo,
    };
  }
}
