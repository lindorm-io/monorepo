import { Logger } from "@lindorm-io/core-logger";
import { KeySetExportKeys, KeySetType, KeySetUsage, LindormJwk, WebKeySet } from "@lindorm-io/jwk";
import { orderBy, uniqBy } from "lodash";
import { StoredKeySet } from "../entities";
import { KeystoreError } from "../errors";
import {
  isKeySetActive,
  isKeySetCorrectType,
  isKeySetCorrectUsage,
  isKeySetExternal,
  isKeySetNotExpired,
  isKeySetPublic,
} from "../utils/private";

export class Keystore {
  readonly #keys: Array<WebKeySet>;
  readonly #logger: Logger;

  public constructor(keys: Array<StoredKeySet | WebKeySet>, logger: Logger) {
    this.#keys = [];
    this.#logger = logger.createChildLogger(["Keystore"]);

    this.addKeys(keys);
  }

  // public getters

  public get allKeys(): Array<WebKeySet> {
    return orderBy(uniqBy(this.#keys, "id"), ["created", "expires"], ["desc", "asc"]);
  }

  public get validKeys(): Array<WebKeySet> {
    return this.allKeys.filter(isKeySetActive).filter(isKeySetNotExpired);
  }

  // public

  public addKey(key: StoredKeySet | WebKeySet): void {
    if (key instanceof StoredKeySet) {
      this.#logger.silly("Adding StoredKeySet", { id: key.id });
      this.#keys.push(key.webKeySet);
      return;
    }

    if (key instanceof WebKeySet) {
      this.#logger.silly("Adding WebKeySet", { id: key.id });
      this.#keys.push(key);
      return;
    }

    throw new KeystoreError("Invalid key type", { debug: { key } });
  }

  public addKeys(keys: Array<StoredKeySet | WebKeySet>): void {
    for (const key of keys) {
      this.addKey(key);
    }
  }

  public findKeys(use?: KeySetUsage, type?: KeySetType): Array<WebKeySet> {
    const keys = this.validKeys.filter(isKeySetCorrectType(type)).filter(isKeySetCorrectUsage(use));

    if (!keys.length) {
      throw new KeystoreError("Keys not found", {
        debug: { type },
        description: "No keys of type were found in Keystore",
      });
    }

    return uniqBy(keys, "id");
  }

  public findKey(use?: KeySetUsage, type?: KeySetType): WebKeySet {
    const keys = this.findKeys(use, type);

    if (!keys.length) {
      throw new KeystoreError("Key not found", {
        debug: { type },
        description: "No keys of type were found in Keystore",
      });
    }

    if (keys.length > 1) {
      this.#logger.warn("Multiple keys found, resolving newest in list", { keys });
    }

    return keys[0];
  }

  public getKey(id: string): WebKeySet {
    const key = this.validKeys.find((x) => x.id === id);

    if (!key) {
      throw new KeystoreError("Invalid Key ID", {
        data: { id },
        description: "Key could not be found with that ID",
      });
    }

    return key;
  }

  public getJwks(
    keys: KeySetExportKeys = "public",
    exportExternalKeys: boolean = false,
  ): Array<LindormJwk> {
    const publicKeys = this.validKeys
      .filter(isKeySetPublic)
      .filter(isKeySetExternal(exportExternalKeys));

    const result: Array<LindormJwk> = [];

    for (const keySet of publicKeys) {
      result.push(keySet.jwk(keys));
    }

    return result;
  }
}
