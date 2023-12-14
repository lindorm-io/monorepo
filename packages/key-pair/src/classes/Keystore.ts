import { orderBy, uniqBy } from "lodash";
import { KeyPair } from "../entities";
import { KeyPairType } from "../enums";
import { KeystoreError } from "../errors";
import { JWK } from "../types";
import {
  isKeyAllowed,
  isKeyCorrectType,
  isKeyExpired,
  isKeyJwkCompatible,
  isKeyNotExpired,
  isKeyPrivate,
  isKeyPublic,
  isKeySigning,
} from "../utils/private";

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
    const publicKeys = this.getKeys().filter(isKeyPublic).filter(isKeyJwkCompatible);
    const keys: Array<JWK> = [];

    for (const keyPair of publicKeys) {
      if (!options.exposeExternal && keyPair.isExternal) continue;

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

  public getKeys(type?: KeyPairType): Array<KeyPair> {
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

  public getPrivateKeys(type?: KeyPairType): Array<KeyPair> {
    const keys = this.getKeys(type).filter(isKeyPrivate);

    if (!keys.length) {
      throw new KeystoreError("Keys not found", {
        description: "No private keys were found in Keystore",
      });
    }

    return orderBy(keys, ["external"], ["asc"]);
  }

  public getSigningKey(type?: KeyPairType): KeyPair {
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
    if (!key.expiresAt) return undefined;
    if (isKeyExpired(key)) return undefined;

    const ttl = key.expiresAt.getTime() - new Date().getTime();

    return {
      seconds: Math.round(ttl / 1000),
      milliseconds: ttl,
    };
  }
}
