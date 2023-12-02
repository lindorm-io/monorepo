import { CertificateMethod } from "@lindorm-io/common-enums";
import { DeviceLink, PublicKey } from "../entity";
import { DeviceLinkRepository, PublicKeyRepository } from "../infrastructure";
import { mongoConnection } from "../instance";
import { logger } from "./util/logger";
import { RSA_KEY } from "./util/rsa-key";

const repositories = {
  deviceLink: new DeviceLinkRepository(mongoConnection, logger),
  publicKey: new PublicKeyRepository(mongoConnection, logger),
};

const main = async (): Promise<void> => {
  const publicKey = await repositories.publicKey.create(
    new PublicKey({
      key: RSA_KEY.publicKey,
    }),
  );

  await repositories.deviceLink.create(
    new DeviceLink({
      id: "bcc17443-5514-44bc-81bc-416a62e83e43",
      active: true,
      biometry: null,
      certificateMethod: CertificateMethod.SHA256,
      identityId: "acbfce9e-072b-450f-b451-5915cdd17a33",
      installationId: "6cd31fe8-898c-4d5f-9926-32d33fcad270",
      metadata: {
        brand: "Brand",
        buildId: "39c0b7cc-484b-4450-a7a2-727688640996",
        buildNumber: "789",
        macAddress: "MA:CA:DD:RE:SS",
        model: "Model",
        systemName: "System Name",
      },
      name: "Name",
      pincode: null,
      publicKeyId: publicKey.id,
      trusted: true,
      uniqueId: "68834dbe-a51d-4df2-8560-cb779c0d6c09",
    }),
  );
};

main()
  .catch((err) => logger.error("Error", err))
  .finally(() => process.exit(0));
