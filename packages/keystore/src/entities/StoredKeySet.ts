import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import {
  KeySetAlgorithm,
  KeySetCurve,
  KeySetOperations,
  KeySetType,
  KeySetUsage,
  WebKeySet,
} from "@lindorm-io/jwk";
import Joi from "joi";

export interface StoredKeySetAttributes extends EntityAttributes {
  algorithm: KeySetAlgorithm;
  curve: KeySetCurve | null;
  expiresAt: Date | null;
  isExternal: boolean;
  jwkUri: string | null;
  notBefore: Date;
  operations: Array<KeySetOperations>;
  ownerId: string | null;
  privateKey: string | null;
  publicKey: string | null;
  type: KeySetType;
  use: KeySetUsage;
}

export type StoredKeySetOptions = Optional<
  StoredKeySetAttributes,
  | EntityKeys
  | "curve"
  | "expiresAt"
  | "isExternal"
  | "jwkUri"
  | "notBefore"
  | "operations"
  | "ownerId"
  | "privateKey"
  | "publicKey"
>;

const schema = Joi.object<StoredKeySetAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    algorithm: Joi.string().required(),
    curve: Joi.string().allow(null).required(),
    expiresAt: Joi.date().allow(null).required(),
    isExternal: Joi.boolean().required(),
    jwkUri: Joi.string().uri().allow(null).required(),
    notBefore: Joi.date().required(),
    operations: Joi.array().items(Joi.string()).required(),
    ownerId: Joi.string().guid().allow(null).required(),
    privateKey: Joi.string().allow(null).required(),
    publicKey: Joi.string().allow(null).required(),
    type: Joi.string().required(),
    use: Joi.string().required(),
  })
  .required();

export class StoredKeySet extends LindormEntity<StoredKeySetAttributes> {
  public readonly webKeySet: WebKeySet;

  public constructor(webKeySet: WebKeySet);
  public constructor(options: StoredKeySetOptions);
  public constructor(options: WebKeySet | StoredKeySetOptions) {
    if (options instanceof WebKeySet) {
      super({ id: options.id, created: options.createdAt, updated: options.updatedAt });

      this.webKeySet = options;
    } else {
      super(options);

      this.webKeySet = new WebKeySet({
        id: this.id,
        algorithm: options.algorithm,
        createdAt: this.created,
        curve: options.curve ?? undefined,
        expiresAt: options.expiresAt ?? undefined,
        isExternal: options.isExternal,
        jwkUri: options.jwkUri ?? undefined,
        notBefore: options.notBefore ?? this.created,
        operations: options.operations,
        ownerId: options.ownerId ?? undefined,
        privateKey: options.privateKey ? Buffer.from(options.privateKey, "base64url") : undefined,
        publicKey: options.publicKey ? Buffer.from(options.publicKey, "base64url") : undefined,
        type: options.type,
        updatedAt: this.updated,
        use: options.use,
      });
    }
  }

  // entity

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): StoredKeySetAttributes {
    const { revision, version } = this.defaultJSON();
    const b64 = this.webKeySet.export("b64");
    const publicKey = WebKeySet.isOctB64(b64) ? null : b64.publicKey;

    return {
      id: this.webKeySet.id,
      algorithm: this.webKeySet.algorithm,
      created: this.webKeySet.createdAt,
      curve: this.webKeySet.curve ?? null,
      expiresAt: this.webKeySet.expiresAt ?? null,
      isExternal: this.webKeySet.isExternal,
      jwkUri: this.webKeySet.jwkUri ?? null,
      notBefore: this.webKeySet.notBefore,
      operations: this.webKeySet.operations,
      ownerId: this.webKeySet.ownerId ?? null,
      privateKey: b64.privateKey ?? null,
      publicKey: publicKey ?? null,
      revision,
      type: this.webKeySet.type,
      updated: this.webKeySet.updatedAt,
      use: this.webKeySet.use,
      version,
    };
  }

  // static

  public static fromWebKeySet(webKeySet: WebKeySet): StoredKeySet {
    return new StoredKeySet(webKeySet);
  }
}
