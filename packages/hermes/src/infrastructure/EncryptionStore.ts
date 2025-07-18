import { AesKit } from "@lindorm/aes";
import { KryptosEncAlgorithm, KryptosEncryption, KryptosKit } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { IEncryptionStore, IHermesEncryptionStore } from "../interfaces";
import {
  AggregateIdentifier,
  EncryptionStoreAttributes,
  HermesEncryptionStoreOptions,
} from "../types";
import { MongoEncryptionStore } from "./mongo";
import { PostgresEncryptionStore } from "./postgres";

export class EncryptionStore implements IHermesEncryptionStore {
  private readonly algorithm: KryptosEncAlgorithm;
  private readonly encryption: KryptosEncryption;
  private readonly logger: ILogger;
  private readonly store: IEncryptionStore;

  public constructor(options: HermesEncryptionStoreOptions) {
    this.logger = options.logger.child(["EncryptionStore"]);
    this.algorithm = options.algorithm ?? "dir";
    this.encryption = options.encryption ?? "A256GCM";

    if (options.custom) {
      this.store = options.custom;
    } else if (options.mongo?.name === "MongoSource") {
      this.store = new MongoEncryptionStore(options.mongo, this.logger);
    } else if (options.postgres?.name === "PostgresSource") {
      this.store = new PostgresEncryptionStore(options.postgres, this.logger);
    } else {
      throw new Error("Invalid EncryptionStore configuration");
    }
  }

  // public

  public async inspect(
    aggregate: AggregateIdentifier,
  ): Promise<EncryptionStoreAttributes | undefined> {
    this.logger.debug("Inspecting encryption keys", { aggregate });

    return await this.store.find({
      id: aggregate.id,
      name: aggregate.name,
      namespace: aggregate.namespace,
    });
  }

  public async load(aggregate: AggregateIdentifier): Promise<AesKit> {
    this.logger.debug("Loading encryption keys", { aggregate });

    const exists = await this.store.find({
      id: aggregate.id,
      name: aggregate.name,
      namespace: aggregate.namespace,
    });

    if (exists) {
      const kryptos = KryptosKit.from.b64({
        id: exists.key_id,
        algorithm: exists.key_algorithm,
        curve: exists.key_curve ?? undefined,
        encryption: exists.key_encryption,
        privateKey: exists.private_key,
        publicKey: exists.public_key,
        type: exists.key_type,
        use: "enc",
      });

      return new AesKit({ kryptos });
    }

    const kryptos = KryptosKit.generate.auto({
      algorithm: this.algorithm,
      encryption: this.encryption,
    });

    const { algorithm, publicKey, privateKey, type, curve, encryption } =
      kryptos.export("b64");

    await this.store.insert({
      id: aggregate.id,
      name: aggregate.name,
      namespace: aggregate.namespace,
      key_id: kryptos.id,
      key_algorithm: algorithm,
      key_curve: curve ?? null,
      key_encryption: encryption!,
      key_type: type,
      private_key: privateKey!,
      public_key: publicKey!,
      created_at: new Date(),
    });

    return new AesKit({ kryptos });
  }
}
