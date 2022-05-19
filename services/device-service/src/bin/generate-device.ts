import { logger } from "./util/logger";
import { DeviceLinkRepository } from "../infrastructure";
import { mongoConnection } from "../instance";
import { DeviceLink, DeviceLinkSalt } from "../entity";
import { getRandomString } from "@lindorm-io/core";
import { CryptoLayered } from "@lindorm-io/crypto";
import { RSA_KEY } from "./util/rsa-key";
import { CertificateMethod } from "../enum";

const repositories = {
  deviceLink: new DeviceLinkRepository({ connection: mongoConnection, logger }),
};

const secrets = {
  biometry: "87429e38268946a1b6741870c9753c27447dbdf3901443029c85c86396ee24ee",
  pincode: "123456",
};

const main = async (): Promise<void> => {
  const salt: DeviceLinkSalt = {
    aes: getRandomString(128),
    sha: getRandomString(128),
  };

  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  await repositories.deviceLink.create(
    new DeviceLink({
      id: "bcc17443-5514-44bc-81bc-416a62e83e43",
      active: true,
      biometry: await crypto.encrypt(secrets.biometry),
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
      pincode: await crypto.encrypt(secrets.pincode),
      publicKey: RSA_KEY.publicKey,
      salt,
      trusted: true,
      uniqueId: "68834dbe-a51d-4df2-8560-cb779c0d6c09",
    }),
  );
};

main()
  .catch((err) => logger.error("Error", err))
  .finally(() => process.exit(0));
