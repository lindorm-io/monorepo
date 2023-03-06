import Joi from "joi";
import { JOI_LOCALE } from "../common";
import { NamingSystem } from "@lindorm-io/common-types";
import {
  JOI_BIRTHDATE,
  JOI_DISPLAY_NAME_OBJECT,
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
  avatarUri: string | null;
  birthDate: string | null;
  displayName: IdentityDisplayName;
  familyName: string | null;
  gender: string | null;
  givenName: string | null;
  locale: string | null;
  maritalStatus: string | null;
  middleName: string | null;
  namingSystem: NamingSystem;
  nickname: string | null;
  picture: string | null;
  preferredAccessibility: Array<string>;
  preferredUsername: string | null;
  profile: string | null;
  pronouns: string | null;
  takenName: string | null;
  username: string | null;
  website: string | null;
  zoneInfo: string | null;
};

export type IdentityOptions = Optional<
  IdentityAttributes,
  | EntityKeys
  | "active"
  | "avatarUri"
  | "birthDate"
  | "displayName"
  | "familyName"
  | "gender"
  | "givenName"
  | "locale"
  | "maritalStatus"
  | "middleName"
  | "namingSystem"
  | "nickname"
  | "picture"
  | "preferredAccessibility"
  | "preferredUsername"
  | "profile"
  | "pronouns"
  | "takenName"
  | "username"
  | "website"
  | "zoneInfo"
>;

const schema = Joi.object<IdentityAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    active: Joi.boolean().required(),
    avatarUri: Joi.string().uri().allow(null).required(),
    birthDate: JOI_BIRTHDATE.allow(null).required(),
    displayName: JOI_DISPLAY_NAME_OBJECT.required(),
    familyName: Joi.string().allow(null).required(),
    gender: Joi.string().allow(null).required(),
    givenName: Joi.string().allow(null).required(),
    locale: JOI_LOCALE.allow(null).required(),
    maritalStatus: Joi.string().allow(null).required(),
    middleName: Joi.string().allow(null).required(),
    namingSystem: JOI_NAMING_SYSTEM.required(),
    nickname: Joi.string().allow(null).required(),
    picture: Joi.string().uri().allow(null).required(),
    preferredAccessibility: Joi.array().items(Joi.string()).required(),
    preferredUsername: Joi.string().allow(null).required(),
    profile: Joi.string().uri().allow(null).required(),
    pronouns: Joi.string().allow(null).required(),
    takenName: Joi.string().allow(null).required(),
    username: Joi.string().lowercase().allow(null).required(),
    website: Joi.string().uri().allow(null).required(),
    zoneInfo: JOI_ZONE_INFO.allow(null).required(),
  })
  .required();

export class Identity extends LindormEntity<IdentityAttributes> {
  public active: boolean;
  public avatarUri: string | null;
  public birthDate: string | null;
  public displayName: IdentityDisplayName;
  public familyName: string | null;
  public gender: string | null;
  public givenName: string | null;
  public locale: string | null;
  public maritalStatus: string | null;
  public middleName: string | null;
  public namingSystem: NamingSystem;
  public nickname: string | null;
  public picture: string | null;
  public preferredAccessibility: Array<string>;
  public preferredUsername: string | null;
  public profile: string | null;
  public pronouns: string | null;
  public takenName: string | null;
  public username: string | null;
  public website: string | null;
  public zoneInfo: string | null;

  public constructor(options: IdentityOptions) {
    super(options);

    this.active = options.active !== false;
    this.avatarUri = options.avatarUri || null;
    this.birthDate = options.birthDate || null;
    this.displayName = {
      name: options.displayName?.name || null,
      number: options.displayName?.number || null,
    };
    this.familyName = options.familyName || null;
    this.gender = options.gender || null;
    this.givenName = options.givenName || null;
    this.locale = options.locale || null;
    this.maritalStatus = options.maritalStatus || null;
    this.middleName = options.middleName || null;
    this.namingSystem = options.namingSystem || NamingSystem.GIVEN_FAMILY;
    this.nickname = options.nickname || null;
    this.picture = options.picture || null;
    this.preferredAccessibility = options.preferredAccessibility || [];
    this.preferredUsername = options.preferredUsername || null;
    this.profile = options.profile || null;
    this.pronouns = options.pronouns || null;
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
      avatarUri: this.avatarUri,
      birthDate: this.birthDate,
      displayName: this.displayName,
      familyName: this.familyName,
      gender: this.gender,
      givenName: this.givenName,
      locale: this.locale,
      maritalStatus: this.maritalStatus,
      middleName: this.middleName,
      namingSystem: this.namingSystem,
      nickname: this.nickname,
      picture: this.picture,
      preferredAccessibility: this.preferredAccessibility,
      preferredUsername: this.preferredUsername,
      profile: this.profile,
      pronouns: this.pronouns,
      takenName: this.takenName,
      username: this.username,
      website: this.website,
      zoneInfo: this.zoneInfo,
    };
  }
}
