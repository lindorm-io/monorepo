import { KeyPairAttributes, KeyPair } from "@lindorm-io/key-pair";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class KeyPairRepository extends LindormRepository<KeyPairAttributes, KeyPair> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "key_pair",
      indices: [
        {
          index: { expires: 1 },
          options: { unique: false },
        },
        {
          index: { external: 1 },
          options: { unique: false },
        },
        {
          index: { preferredAlgorithm: 1 },
          options: { unique: false },
        },
        {
          index: { type: 1 },
          options: { unique: false },
        },
      ],
    });
  }

  protected createEntity(data: KeyPairAttributes): KeyPair {
    return new KeyPair(data);
  }
}
