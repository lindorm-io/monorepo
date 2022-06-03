import { JWK } from "../types";
import { KeyPair } from "../entity";
import { KeyType } from "../enum";
import { KeystoreError } from "../error";
import { filter, find, orderBy, uniqBy } from "lodash";
import { isKeyExpired, isKeyPrivate, isKeyUsable } from "../util";

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

  public getJWKS(options: Partial<GetJWKSOptions> = {}): Array<JWK> {
    const keys: Array<JWK> = [];

    for (const keyPair of this.getKeys()) {
      if (!options.exposeExternal && keyPair.external) continue;
      keys.push(keyPair.toJWK(options.exposePrivate));
    }

    return keys;
  }

  public getKey(id: string): KeyPair {
    const key = find(this.getKeys(), { id });

    if (!key) {
      throw new KeystoreError("Key could not be found", {
        data: { id },
      });
    }

    return key;
  }

  public getKeys(type?: KeyType): Array<KeyPair> {
    const keys = filter(uniqBy(this.keys, "id"), isKeyUsable);
    if (!type) return keys;

    return filter(keys, { type });
  }

  public getPrivateKeys(type?: KeyType): Array<KeyPair> {
    return orderBy(filter(this.getKeys(type), isKeyPrivate), ["external"], ["asc"]);
  }

  public getSigningKey(type?: KeyType): KeyPair {
    const keys = this.getPrivateKeys(type);

    if (!keys.length) {
      throw new KeystoreError("Private Keys could not be found", {
        debug: { keys: this.keys },
      });
    }

    return keys[0];
  }

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
