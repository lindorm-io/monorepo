import Joi from "joi";
import { getRandomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import {
  JOI_GUID,
  JOI_LEVEL_OF_ASSURANCE,
  JOI_LOCALE,
  JOI_NONCE,
  LevelOfAssurance,
} from "../common";
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

const schema = Joi.object<RefreshSessionAttributes>({
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
});

export class RefreshSession extends LindormEntity<RefreshSessionAttributes> {
  public readonly acrValues: Array<string>;
  public readonly amrValues: Array<string>;
  public readonly clientId: string;
  public readonly identityId: string;
  public readonly levelOfAssurance: LevelOfAssurance;
  public readonly nonce: string;
  public readonly previousRefreshSessionId: string;
  public readonly uiLocales: Array<string>;

  public expires: Date;
  public latestAuthentication: Date;
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
    this.nonce = options.nonce || getRandomString(16);
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
