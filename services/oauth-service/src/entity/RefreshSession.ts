import Joi from "joi";
import { JOI_GUID, JOI_LEVEL_OF_ASSURANCE, JOI_LOCALE, JOI_NONCE } from "../common";
import { LevelOfAssurance } from "@lindorm-io/jwt";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface RefreshSessionAttributes extends EntityAttributes {
  acrValues: Array<string>;
  amrValues: Array<string>;
  clientId: string;
  expires: Date;
  identityId: string;
  latestAuthentication: Date;
  levelOfAssurance: LevelOfAssurance;
  nonce: string;
  previousRefreshSessionId: string;
  tokenId: string;
  uiLocales: Array<string>;
}

export type RefreshSessionOptions = Optional<
  RefreshSessionAttributes,
  | EntityKeys
  | "latestAuthentication"
  | "nonce"
  | "previousRefreshSessionId"
  | "tokenId"
  | "uiLocales"
>;

const schema = Joi.object<RefreshSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    acrValues: Joi.array().items(Joi.string().lowercase()).required(),
    amrValues: Joi.array().items(Joi.string().lowercase()).required(),
    clientId: JOI_GUID.required(),
    expires: Joi.date().required(),
    identityId: JOI_GUID.required(),
    latestAuthentication: Joi.date().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    nonce: JOI_NONCE.required(),
    previousRefreshSessionId: JOI_GUID.allow(null).required(),
    tokenId: JOI_GUID.required(),
    uiLocales: Joi.array().items(JOI_LOCALE).required(),
  })
  .required();

export class RefreshSession extends LindormEntity<RefreshSessionAttributes> {
  public readonly clientId: string;
  public readonly identityId: string;
  public readonly nonce: string;
  public readonly previousRefreshSessionId: string;
  public readonly uiLocales: Array<string>;

  public acrValues: Array<string>;
  public amrValues: Array<string>;
  public expires: Date;
  public latestAuthentication: Date;
  public levelOfAssurance: LevelOfAssurance;
  public tokenId: string;

  public constructor(options: RefreshSessionOptions) {
    super(options);

    this.acrValues = options.acrValues;
    this.amrValues = options.amrValues;
    this.clientId = options.clientId;
    this.expires = options.expires;
    this.identityId = options.identityId;
    this.latestAuthentication = options.latestAuthentication || new Date();
    this.levelOfAssurance = options.levelOfAssurance;
    this.nonce = options.nonce || randomString(16);
    this.previousRefreshSessionId = options.previousRefreshSessionId || null;
    this.tokenId = options.tokenId || randomUUID();
    this.uiLocales = options.uiLocales || [];
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): RefreshSessionAttributes {
    return {
      ...this.defaultJSON(),

      acrValues: this.acrValues,
      amrValues: this.amrValues,
      clientId: this.clientId,
      expires: this.expires,
      identityId: this.identityId,
      latestAuthentication: this.latestAuthentication,
      levelOfAssurance: this.levelOfAssurance,
      nonce: this.nonce,
      previousRefreshSessionId: this.previousRefreshSessionId,
      tokenId: this.tokenId,
      uiLocales: this.uiLocales,
    };
  }
}
