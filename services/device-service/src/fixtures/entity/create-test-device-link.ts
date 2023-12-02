import { CertificateMethod } from "@lindorm-io/common-enums";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { DeviceLink, DeviceLinkOptions } from "../../entity";

export const createTestDeviceLink = (options: Partial<DeviceLinkOptions> = {}): DeviceLink =>
  new DeviceLink({
    active: true,
    biometry: null,
    certificateMethod: CertificateMethod.SHA512,
    identityId: randomUUID(),
    installationId: randomUUID(),
    metadata: {
      brand: "Apple",
      buildId: "12A269",
      buildNumber: "89",
      macAddress: "0B:ED:A0:D5:5A:2D",
      model: "iPhone7,2",
      systemName: "iOS",
    },
    name: "Test DeviceLink Name",
    pincode: null,
    publicKeyId: randomUUID(),
    trusted: true,
    uniqueId: randomString(32),
    ...options,
  });
