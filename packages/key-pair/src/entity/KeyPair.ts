import Joi from "joi";
import { Algorithm, KeyType, NamedCurve } from "../enum";
import { JoseData, JWK, KeyJWK } from "../types";
import { KeyPairError } from "../error";
import { camelKeys, snakeKeys } from "@lindorm-io/core";
import { decodeKeys, encodeKeys } from "../util";
import { getUnixTime } from "date-fns";
import { includes, isString, orderBy } from "lodash";
import {
  JOI_KEY_ALGORITHM,
  JOI_KEY_ALGORITHMS,
  JOI_KEY_NAMED_CURVE,
  JOI_KEY_TYPE,
} from "../constant";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface KeyPairAttributes extends EntityAttributes {
  algorithms: Array<Algorithm>;
  allowed: Date;
  expires: Date | null;
  external: boolean;
  namedCurve: NamedCurve | null;
  passphrase: string | null;
  preferredAlgorithm: Algorithm;
  privateKey: string | null;
  publicKey: string;
  type: KeyType;
}

export type KeyPairOptions = Optional<
  KeyPairAttributes,
  | EntityKeys
  | "allowed"
  | "expires"
  | "external"
  | "namedCurve"
  | "passphrase"
  | "preferredAlgorithm"
  | "privateKey"
>;

const schema = Joi.object({
  ...JOI_ENTITY_BASE,

  algorithms: JOI_KEY_ALGORITHMS.required(),
  allowed: Joi.date().required(),
  expires: Joi.date().allow(null).required(),
  external: Joi.boolean().required(),
  namedCurve: JOI_KEY_NAMED_CURVE.allow(null).required(),
  passphrase: Joi.string().allow(null).required(),
  preferredAlgorithm: JOI_KEY_ALGORITHM.required(),
  privateKey: Joi.string().allow(null).required(),
  publicKey: Joi.string().required(),
  type: JOI_KEY_TYPE.required(),
});

export class KeyPair extends LindormEntity<KeyPairAttributes> {
  public readonly algorithms: Array<Algorithm>;
  public readonly external: boolean;
  public readonly namedCurve: NamedCurve | null;
  public readonly passphrase: string | null;
  public readonly privateKey: string | null;
  public readonly publicKey: string;
  public readonly type: KeyType;

  private _preferredAlgorithm: Algorithm;

  public allowed: Date;
  public expires: Date | null;

  public constructor(options: KeyPairOptions) {
    super(options);

    this._preferredAlgorithm =
      options.preferredAlgorithm ||
      orderBy(options.algorithms, [(item): Algorithm => item], ["desc"])[0];

    this.algorithms = options.algorithms;
    this.allowed = options.allowed || this.created;
    this.expires = options.expires || null;
    this.external = options.external === true;
    this.namedCurve = options.namedCurve || null;
    this.passphrase = options.passphrase || null;
    this.privateKey = options.privateKey || null;
    this.publicKey = options.publicKey;
    this.type = options.type;
  }

  public get preferredAlgorithm(): Algorithm {
    return this._preferredAlgorithm;
  }
  public set preferredAlgorithm(preferredAlgorithm: Algorithm) {
    if (!includes(this.algorithms, preferredAlgorithm)) {
      throw new KeyPairError("Invalid preferredAlgorithm", {
        data: { preferredAlgorithm },
        debug: {
          algorithms: this.algorithms,
        },
      });
    }

    this._preferredAlgorithm = preferredAlgorithm;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): KeyPairAttributes {
    return {
      ...this.defaultJSON(),

      algorithms: this.algorithms,
      allowed: this.allowed,
      expires: this.expires,
      external: this.external,
      namedCurve: this.namedCurve,
      passphrase: this.passphrase,
      preferredAlgorithm: this.preferredAlgorithm,
      privateKey: this.privateKey,
      publicKey: this.publicKey,
      type: this.type,
    };
  }

  public toJWK(exposePrivateKey = false): JWK {
    const data: KeyJWK = encodeKeys({
      exposePrivateKey,
      namedCurve: this.namedCurve,
      privateKey: this.privateKey,
      publicKey: this.publicKey,
      type: this.type,
    });

    const keyOps = ["verify"];

    if (isString(this.privateKey)) {
      keyOps.push("sign");

      if (this.type === KeyType.RSA && (this.passphrase?.length || 0) < 1) {
        keyOps.push("encrypt");
      }
    }
    if (this.type === KeyType.RSA) {
      keyOps.push("decrypt");
    }

    return snakeKeys({
      alg: this.preferredAlgorithm,
      allowedFrom: getUnixTime(this.allowed),
      createdAt: getUnixTime(this.created),
      crv: this.namedCurve ? this.namedCurve : undefined,
      expiresAt: this.expires ? getUnixTime(this.expires) : undefined,
      keyOps: keyOps.sort(),
      kid: this.id,
      kty: this.type,
      use: "sig",
      ...data,
    });
  }

  public static fromJWK(input: JWK): KeyPair {
    const data: JoseData = decodeKeys(input);
    const jwk = camelKeys(input);

    return new KeyPair({
      id: jwk.kid,
      algorithms: [jwk.alg as Algorithm],
      allowed: jwk.allowedFrom ? new Date(jwk.allowedFrom * 1000) : undefined,
      created: jwk.createdAt ? new Date(jwk.createdAt * 1000) : undefined,
      expires: jwk.expiresAt ? new Date(jwk.expiresAt * 1000) : undefined,
      external: true,
      namedCurve: jwk.crv ? (jwk.crv as NamedCurve) : undefined,
      preferredAlgorithm: jwk.alg as Algorithm,
      type: jwk.kty as KeyType,
      ...data,
    });
  }
}
