import { orderBy, uniqBy } from "lodash";
import { KeyPair } from "../entity";
import { Algorithm, KeyType } from "../enum";
import { KeystoreError } from "../error";
import { JWK } from "../types";
import {
  isKeyAllowed,
  isKeyCorrectType,
  isKeyExpired,
  isKeyNotExpired,
  isKeyPrivate,
  isKeySigning,
} from "../util";

export interface KeystoreOptions {
  keys: Array<KeyPair>;
}

interface GetJWKSOptions {
  exposePrivate: boolean;
  exposeExternal: boolean;
}

interface TTL {
  seconds: number;
  milliseconds: number;
}

export class Keystore {
  private readonly keys: Array<KeyPair>;

  public constructor(options: KeystoreOptions) {
    const keys = options.keys;

    if (!keys.length) {
      throw new KeystoreError("Keystore was initialised without keys", {
        debug: { keys },
      });
    }

    this.keys = orderBy(keys, ["created", "expires"], ["desc", "asc"]);
  }

  // public

  public assert(): void {
    const keys = this.keys.filter(isKeyAllowed).filter(isKeyNotExpired);

    if (keys.length) return;

    throw new KeystoreError("Keys not found", {
      description: "No keys  were found in Keystore",
    });
  }

  public getJWKS(options: Partial<GetJWKSOptions> = {}): Array<JWK> {
    const keys: Array<JWK> = [];

    for (const keyPair of this.getKeys()) {
      if (!options.exposeExternal && keyPair.external) continue;
      if ([Algorithm.HS256, Algorithm.HS384, Algorithm.HS512].includes(keyPair.preferredAlgorithm))
        continue;

      keys.push(keyPair.toJWK(options.exposePrivate));
    }

    return keys;
  }

  public getKey(id: string): KeyPair {
    const key = this.getKeys().find((x) => x.id === id);

    if (!key) {
      throw new KeystoreError("Invalid Key ID", {
        data: { id },
        description: "Key could not be found with that ID",
      });
    }

    return key;
  }

  public getKeys(type?: KeyType): Array<KeyPair> {
    const keys = this.keys
      .filter(isKeyCorrectType(type))
      .filter(isKeyAllowed)
      .filter(isKeyNotExpired);

    if (!keys.length) {
      throw new KeystoreError("Keys not found", {
        debug: { type },
        description: "No keys of type were found in Keystore",
      });
    }

    return uniqBy(keys, "id");
  }

  public getPrivateKeys(type?: KeyType): Array<KeyPair> {
    const keys = this.getKeys(type).filter(isKeyPrivate);

    if (!keys.length) {
      throw new KeystoreError("Keys not found", {
        description: "No private keys were found in Keystore",
      });
    }

    return orderBy(keys, ["external"], ["asc"]);
  }

  public getSigningKey(type?: KeyType): KeyPair {
    const [key] = this.getPrivateKeys(type).filter(isKeySigning);

    if (!key) {
      throw new KeystoreError("Keys not found", {
        description: "No signing keys were found in Keystore",
      });
    }

    return key;
  }

  // static

  public static getTTL(key: KeyPair): TTL | undefined {
    if (!key.expires) return undefined;
    if (isKeyExpired(key)) return undefined;

    const ttl = key.expires.getTime() - new Date().getTime();

    return {
      seconds: Math.round(ttl / 1000),
      milliseconds: ttl,
    };
  }
}
