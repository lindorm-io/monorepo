import { LindormCache, CacheOptions } from "@lindorm-io/redis";
import { KeyPairAttributes, KeyPair } from "@lindorm-io/key-pair";

export class KeyPairCache extends LindormCache<KeyPairAttributes, KeyPair> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "KeyPair",
      indexedAttributes: ["type"],
    });
  }

  protected createEntity(data: KeyPairAttributes): KeyPair {
    return new KeyPair(data);
  }
}
