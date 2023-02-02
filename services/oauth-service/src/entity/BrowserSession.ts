import Joi from "joi";
import { LevelOfAssurance } from "@lindorm-io/jwt";
import { randomString } from "@lindorm-io/random";
import {
  AuthenticationMethod,
  JOI_COUNTRY_CODE,
  JOI_GUID,
  JOI_LEVEL_OF_ASSURANCE,
  JOI_LOCALE,
  JOI_NONCE,
} from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface BrowserSessionAttributes extends EntityAttributes {
  acrValues: Array<string>;
  amrValues: Array<AuthenticationMethod>;
  clients: Array<string>;
  country: string | null;
  expires: Date;
  identityId: string;
  latestAuthentication: Date;
  levelOfAssurance: LevelOfAssurance;
  nonce: string;
  remember: boolean;
  uiLocales: Array<string>;
}

export type BrowserSessionOptions = Optional<
  BrowserSessionAttributes,
  EntityKeys | "country" | "nonce" | "remember" | "uiLocales"
>;

const schema = Joi.object<BrowserSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    acrValues: Joi.array().items(Joi.string().lowercase()).required(),
    amrValues: Joi.array().items(Joi.string().lowercase()).required(),
    clients: Joi.array().items(JOI_GUID).required(),
    country: JOI_COUNTRY_CODE.allow(null).required(),
    expires: Joi.date().required(),
    identityId: JOI_GUID.required(),
    latestAuthentication: Joi.date().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    nonce: JOI_NONCE.required(),
    remember: Joi.boolean().required(),
    uiLocales: Joi.array().items(JOI_LOCALE).required(),
  })
  .required();

export class BrowserSession extends LindormEntity<BrowserSessionAttributes> {
  public readonly consentSessionId: string;
  public readonly identityId: string;

  public acrValues: Array<string>;
  public amrValues: Array<AuthenticationMethod>;
  public clients: Array<string>;
  public country: string | null;
  public expires: Date;
  public latestAuthentication: Date;
  public levelOfAssurance: LevelOfAssurance;
  public nonce: string;
  public remember: boolean;
  public uiLocales: Array<string>;

  public constructor(options: BrowserSessionOptions) {
    super(options);

    this.acrValues = options.acrValues;
    this.amrValues = options.amrValues;
    this.clients = options.clients;
    this.country = options.country || null;
    this.expires = options.expires;
    this.identityId = options.identityId;
    this.latestAuthentication = options.latestAuthentication;
    this.levelOfAssurance = options.levelOfAssurance;
    this.nonce = options.nonce || randomString(16);
    this.remember = options.remember === true;
    this.uiLocales = options.uiLocales || [];
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): BrowserSessionAttributes {
    return {
      ...this.defaultJSON(),

      acrValues: this.acrValues,
      amrValues: this.amrValues,
      clients: this.clients,
      country: this.country,
      expires: this.expires,
      identityId: this.identityId,
      latestAuthentication: this.latestAuthentication,
      levelOfAssurance: this.levelOfAssurance,
      nonce: this.nonce,
      remember: this.remember,
      uiLocales: this.uiLocales,
    };
  }
}
