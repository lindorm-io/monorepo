import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import { RsaKeySet } from "@lindorm-io/jwk";
import Joi from "joi";

export interface PublicKeyAttributes extends EntityAttributes {
  key: string;
}

export type PublicKeyOptions = Optional<PublicKeyAttributes, EntityKeys>;

const schema = Joi.object<PublicKeyAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    key: Joi.string().required(),
  })
  .required();

export class PublicKey extends LindormEntity<PublicKeyAttributes> {
  public readonly keySet: RsaKeySet;

  public constructor(options: PublicKeyOptions) {
    super(options);

    this.keySet = RsaKeySet.fromB64({
      id: this.id,
      publicKey: options.key,
      type: "RSA",
    });
  }

  // entity

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): PublicKeyAttributes {
    const b64 = this.keySet.export("b64");

    return {
      ...this.defaultJSON(),

      key: b64.publicKey,
    };
  }

  // static

  public static fromKeySet(keySet: RsaKeySet): PublicKey {
    const { id, publicKey } = keySet.export("b64");
    return new PublicKey({ id, key: publicKey });
  }
}
