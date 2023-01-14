import Joi from "joi";
import { Algorithm, KeyOperation, KeyType, NamedCurve } from "../enum";
import { JoseData, JWK, KeyJWK } from "../types";
import { KeyPairError } from "../error";
import { camelCase, snakeCase } from "@lindorm-io/case";
import { decodeKeys, encodeKeys } from "../util";
import { fromUnixTime, getUnixTime } from "date-fns";
import { orderBy } from "lodash";
import { removeUndefinedFromObject } from "@lindorm-io/core";
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
  operations: Array<KeyOperation>;
  origin: string | null;
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
  | "operations"
  | "origin"
  | "passphrase"
  | "preferredAlgorithm"
  | "privateKey"
>;

interface CalculateOperationsOptions {
  passphrase?: string | null;
  privateKey?: string | null;
  type: KeyType;
}

const schema = Joi.object<KeyPairAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    algorithms: JOI_KEY_ALGORITHMS.required(),
    allowed: Joi.date().required(),
    expires: Joi.date().allow(null).required(),
    external: Joi.boolean().required(),
    namedCurve: JOI_KEY_NAMED_CURVE.allow(null).required(),
    operations: Joi.array().items(Joi.string()).required(),
    origin: Joi.string().uri().allow(null).required(),
    passphrase: Joi.string().allow(null).required(),
    preferredAlgorithm: JOI_KEY_ALGORITHM.required(),
    privateKey: Joi.string().allow(null).required(),
    publicKey: Joi.string().required(),
    type: JOI_KEY_TYPE.required(),
  })
  .required();

export class KeyPair extends LindormEntity<KeyPairAttributes> {
  public readonly algorithms: Array<Algorithm>;
  public readonly external: boolean;
  public readonly namedCurve: NamedCurve | null;
  public readonly operations: Array<KeyOperation>;
  public readonly origin: string | null;
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
    this.operations = options.operations?.length
      ? options.operations
      : KeyPair.calculateOperations(options);
    this.origin = options.origin || null;
    this.passphrase = options.passphrase || null;
    this.privateKey = options.privateKey || null;
    this.publicKey = options.publicKey;
    this.type = options.type;
  }

  public get preferredAlgorithm(): Algorithm {
    return this._preferredAlgorithm;
  }

  public set preferredAlgorithm(preferredAlgorithm: Algorithm) {
    if (!this.algorithms.includes(preferredAlgorithm)) {
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
      operations: this.operations,
      origin: this.origin,
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

    const keyOps = KeyPair.calculateOperations({
      passphrase: exposePrivateKey ? this.passphrase : undefined,
      privateKey: exposePrivateKey ? this.privateKey : undefined,
      type: this.type,
    });

    return removeUndefinedFromObject(
      snakeCase({
        alg: this.preferredAlgorithm,
        allowedFrom: getUnixTime(this.allowed),
        createdAt: getUnixTime(this.created),
        crv: this.namedCurve ? this.namedCurve : undefined,
        expiresAt: this.expires ? getUnixTime(this.expires) : undefined,
        keyOps,
        kid: this.id,
        kty: this.type,
        origin: this.origin ? this.origin : undefined,
        use: "sig",
        ...data,
      }),
    );
  }

  public static fromJWK(input: JWK): KeyPair {
    const data: JoseData = decodeKeys(input);
    const jwk = camelCase<JWK>(input);

    return new KeyPair({
      id: jwk.kid,
      algorithms: [jwk.alg as Algorithm],
      allowed: jwk.allowedFrom ? fromUnixTime(jwk.allowedFrom) : undefined,
      created: jwk.createdAt ? fromUnixTime(jwk.createdAt) : undefined,
      expires: jwk.expiresAt ? fromUnixTime(jwk.expiresAt) : undefined,
      external: true,
      operations: jwk.keyOps as Array<KeyOperation>,
      namedCurve: jwk.crv ? (jwk.crv as NamedCurve) : undefined,
      origin: jwk.origin,
      preferredAlgorithm: jwk.alg as Algorithm,
      type: jwk.kty as KeyType,
      ...data,
    });
  }

  private static calculateOperations(options: CalculateOperationsOptions): Array<KeyOperation> {
    const result: Array<KeyOperation> = [KeyOperation.VERIFY];

    if (options.type === KeyType.RSA) {
      result.push(KeyOperation.DECRYPT);
    }

    if (typeof options.privateKey === "string") {
      result.push(KeyOperation.SIGN);

      if (options.type === KeyType.RSA) {
        result.push(KeyOperation.ENCRYPT);
      }
    }

    return result.sort();
  }
}
