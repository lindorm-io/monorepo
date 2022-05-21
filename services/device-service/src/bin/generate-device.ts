import { CertificateMethod } from "../enum";
import { DeviceLink } from "../entity";
import { DeviceLinkRepository } from "../infrastructure";
import { RSA_KEY } from "./util/rsa-key";
import { logger } from "./util/logger";
import { mongoConnection } from "../instance";

const repositories = {
  deviceLink: new DeviceLinkRepository({ connection: mongoConnection, logger }),
};

const main = async (): Promise<void> => {
  await repositories.deviceLink.create(
    new DeviceLink({
      id: "bcc17443-5514-44bc-81bc-416a62e83e43",
      active: true,
      biometry: null,
      certificateMethod: CertificateMethod.SHA256,
      deviceMetadata: {
        brand: "Brand",
        buildId: "39c0b7cc-484b-4450-a7a2-727688640996",
        buildNumber: "789",
        macAddress: "MA:CA:DD:RE:SS",
        model: "Model",
        systemName: "System Name",
      },
      fingerprint: "21cc7f3c-c873-4ef5-924d-c6ea3d618c27",
      identityId: "acbfce9e-072b-450f-b451-5915cdd17a33",
      installationId: "6cd31fe8-898c-4d5f-9926-32d33fcad270",
      name: "Name",
      pincode: null,
      publicKey: RSA_KEY.publicKey,
      trusted: true,
      uniqueId: "68834dbe-a51d-4df2-8560-cb779c0d6c09",
    }),
  );
};

main()
  .catch((err) => logger.error("Error", err))
  .finally(() => process.exit(0));
