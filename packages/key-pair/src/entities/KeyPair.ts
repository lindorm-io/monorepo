import { camelCase, snakeCase } from "@lindorm-io/case";
import { removeUndefinedFromObject } from "@lindorm-io/core";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import { fromUnixTime, getUnixTime } from "date-fns";
import Joi from "joi";
import { orderBy } from "lodash";
import { KeyPairAlgorithm, KeyPairOperation, KeyPairType, NamedCurve } from "../enums";
import { KeyPairError } from "../errors";
import { JWK, JoseData, KeyJWK } from "../types";
import { decodeKeys, encodeKeys } from "../utils/private";

export interface KeyPairAttributes extends EntityAttributes {
  algorithms: Array<KeyPairAlgorithm>;
  expiresAt: Date | null;
  isExternal: boolean;
  namedCurve: NamedCurve | null;
  notBefore: Date;
  operations: Array<KeyPairOperation>;
  originUri: string | null;
  ownerId: string | null;
  passphrase: string | null;
  preferredAlgorithm: KeyPairAlgorithm;
  privateKey: string | null;
  publicKey: string | null;
  type: KeyPairType;
}

export type KeyPairOptions = Optional<
  KeyPairAttributes,
  | EntityKeys
  | "expiresAt"
  | "isExternal"
  | "namedCurve"
  | "notBefore"
  | "operations"
  | "originUri"
  | "ownerId"
  | "passphrase"
  | "preferredAlgorithm"
  | "privateKey"
  | "publicKey"
>;

interface CalculateOperationsOptions {
  passphrase?: string | null;
  privateKey?: string | null;
  type: KeyPairType;
}

const schema = Joi.object<KeyPairAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    algorithms: Joi.array()
      .items(Joi.string().valid(...Object.values(KeyPairAlgorithm)))
      .required(),
    expiresAt: Joi.date().allow(null).required(),
    isExternal: Joi.boolean().required(),
    namedCurve: Joi.string()
      .valid(...Object.values(NamedCurve))
      .allow(null)
      .required(),
    notBefore: Joi.date().required(),
    operations: Joi.array().items(Joi.string()).required(),
    originUri: Joi.string().uri().allow(null).required(),
    ownerId: Joi.string().guid().allow(null).required(),
    passphrase: Joi.string().allow(null).required(),
    preferredAlgorithm: Joi.string()
      .valid(...Object.values(KeyPairAlgorithm))
      .required(),
    privateKey: Joi.string().allow(null).required(),
    publicKey: Joi.string().allow(null).required(),
    type: Joi.string()
      .valid(...Object.values(KeyPairType))
      .required(),
  })
  .required();

export class KeyPair extends LindormEntity<KeyPairAttributes> {
  public readonly algorithms: Array<KeyPairAlgorithm>;
  public readonly isExternal: boolean;
  public readonly namedCurve: NamedCurve | null;
  public readonly operations: Array<KeyPairOperation>;
  public readonly originUri: string | null;
  public readonly ownerId: string | null;
  public readonly passphrase: string | null;
  public readonly privateKey: string | null;
  public readonly publicKey: string | null;
  public readonly type: KeyPairType;

  private _preferredAlgorithm: KeyPairAlgorithm;

  public notBefore: Date;
  public expiresAt: Date | null;

  public constructor(options: KeyPairOptions) {
    super(options);

    this._preferredAlgorithm =
      options.preferredAlgorithm ||
      orderBy(options.algorithms, [(item): KeyPairAlgorithm => item], ["desc"])[0];

    this.algorithms = options.algorithms;
    this.expiresAt = options.expiresAt || null;
    this.isExternal = options.isExternal === true;
    this.namedCurve = options.namedCurve || null;
    this.notBefore = options.notBefore || this.created;
    this.operations = options.operations?.length
      ? options.operations
      : KeyPair.calculateOperations(options);
    this.originUri = options.originUri || null;
    this.ownerId = options.ownerId || null;
    this.passphrase = options.passphrase || null;
    this.privateKey = options.privateKey || null;
    this.publicKey = options.publicKey || null;
    this.type = options.type;
  }

  public get preferredAlgorithm(): KeyPairAlgorithm {
    return this._preferredAlgorithm;
  }

  public set preferredAlgorithm(preferredAlgorithm: KeyPairAlgorithm) {
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
      expiresAt: this.expiresAt,
      isExternal: this.isExternal,
      namedCurve: this.namedCurve,
      notBefore: this.notBefore,
      operations: this.operations,
      originUri: this.originUri,
      ownerId: this.ownerId,
      passphrase: this.passphrase,
      preferredAlgorithm: this.preferredAlgorithm,
      privateKey: this.privateKey,
      publicKey: this.publicKey,
      type: this.type,
    };
  }

  public toJWK(exposePrivateKey = false): JWK {
    if (!this.publicKey) {
      throw new KeyPairError("KeyPair has no public key");
    }

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
        createdAt: getUnixTime(this.created),
        crv: this.namedCurve ? this.namedCurve : undefined,
        expiresAt: this.expiresAt ? getUnixTime(this.expiresAt) : undefined,
        keyOps,
        kid: this.id,
        kty: this.type,
        notBefore: getUnixTime(this.notBefore),
        originUri: this.originUri ? this.originUri : undefined,
        ownerId: this.ownerId ? this.ownerId : undefined,
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
      algorithms: [jwk.alg as KeyPairAlgorithm],
      created: jwk.createdAt ? fromUnixTime(jwk.createdAt) : undefined,
      expiresAt: jwk.expiresAt ? fromUnixTime(jwk.expiresAt) : undefined,
      isExternal: true,
      namedCurve: jwk.crv ? (jwk.crv as NamedCurve) : undefined,
      notBefore: jwk.notBefore ? fromUnixTime(jwk.notBefore) : undefined,
      operations: jwk.keyOps as Array<KeyPairOperation>,
      originUri: jwk.originUri,
      ownerId: jwk.ownerId,
      preferredAlgorithm: jwk.alg as KeyPairAlgorithm,
      type: jwk.kty as KeyPairType,
      ...data,
    });
  }

  private static calculateOperations(options: CalculateOperationsOptions): Array<KeyPairOperation> {
    const result: Array<KeyPairOperation> = [KeyPairOperation.VERIFY];

    if (options.type === KeyPairType.RSA) {
      result.push(KeyPairOperation.DECRYPT);
    }

    if (typeof options.privateKey === "string") {
      result.push(KeyPairOperation.SIGN);

      if (options.type === KeyPairType.RSA) {
        result.push(KeyPairOperation.ENCRYPT);
      }
    }

    return result.sort();
  }
}
