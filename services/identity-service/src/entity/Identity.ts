import Joi from "joi";
import { NamingSystem } from "../enum";
import { IdentityPermission, JOI_LOCALE } from "../common";
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

export interface IdentityDisplayName {
  name: string;
  number: number;
}

export interface IdentityAttributes extends EntityAttributes {
  active: boolean;
  birthDate: string;
  displayName: IdentityDisplayName;
  familyName: string;
  gender: string;
  givenName: string;
  gravatarUri: string;
  locale: string;
  middleName: string;
  namingSystem: string;
  nationalIdentityNumber: string;
  nationalIdentityNumberVerified: boolean;
  nickname: string;
  permissions: Array<string>;
  picture: string;
  preferredAccessibility: Array<string>;
  preferredUsername: string;
  profile: string;
  pronouns: string;
  socialSecurityNumber: string;
  socialSecurityNumberVerified: boolean;
  username: string;
  website: string;
  zoneInfo: string;
}

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
  | "permissions"
  | "picture"
  | "preferredAccessibility"
  | "preferredUsername"
  | "profile"
  | "pronouns"
  | "socialSecurityNumber"
  | "socialSecurityNumberVerified"
  | "username"
  | "website"
  | "zoneInfo"
>;

const schema = Joi.object<IdentityAttributes>({
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
  permissions: Joi.array().items(Joi.string()).required(),
  picture: Joi.string().uri().allow(null).required(),
  preferredAccessibility: Joi.array().items(Joi.string()).required(),
  preferredUsername: Joi.string().allow(null).required(),
  profile: Joi.string().uri().allow(null).required(),
  pronouns: Joi.string().allow(null).required(),
  socialSecurityNumber: Joi.string().allow(null).required(),
  socialSecurityNumberVerified: Joi.boolean().required(),
  username: Joi.string().lowercase().allow(null).required(),
  website: Joi.string().uri().allow(null).required(),
  zoneInfo: JOI_ZONE_INFO.allow(null).required(),
});

export class Identity extends LindormEntity<IdentityAttributes> {
  public active: boolean;
  public birthDate: string;
  public displayName: IdentityDisplayName;
  public familyName: string;
  public gender: string;
  public givenName: string;
  public gravatarUri: string;
  public locale: string;
  public middleName: string;
  public namingSystem: string;
  public nationalIdentityNumber: string;
  public nationalIdentityNumberVerified: boolean;
  public nickname: string;
  public permissions: Array<string>;
  public picture: string;
  public preferredAccessibility: Array<string>;
  public preferredUsername: string;
  public profile: string;
  public pronouns: string;
  public socialSecurityNumber: string;
  public socialSecurityNumberVerified: boolean;
  public username: string;
  public website: string;
  public zoneInfo: string;

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
    this.permissions = options.permissions || [
      IdentityPermission.USER,
      IdentityPermission.CLIENT_READ,
      IdentityPermission.CLIENT_WRITE,
      IdentityPermission.IDENTITY_READ,
      IdentityPermission.IDENTITY_WRITE,
      IdentityPermission.TENANT_READ,
      IdentityPermission.TENANT_WRITE,
    ];
    this.picture = options.picture || null;
    this.preferredAccessibility = options.preferredAccessibility || [];
    this.preferredUsername = options.preferredUsername || null;
    this.profile = options.profile || null;
    this.pronouns = options.pronouns || null;
    this.socialSecurityNumber = options.socialSecurityNumber || null;
    this.socialSecurityNumberVerified = options.socialSecurityNumberVerified === true;
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
      permissions: this.permissions,
      picture: this.picture,
      preferredAccessibility: this.preferredAccessibility,
      preferredUsername: this.preferredUsername,
      profile: this.profile,
      pronouns: this.pronouns,
      socialSecurityNumber: this.socialSecurityNumber,
      socialSecurityNumberVerified: this.socialSecurityNumberVerified,
      username: this.username,
      website: this.website,
      zoneInfo: this.zoneInfo,
    };
  }
}
