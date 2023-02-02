import { CertificateMethod } from "../../enum";
import { DeviceLink, DeviceLinkOptions } from "../../entity";
import { randomUUID } from "crypto";
import { randomString } from "@lindorm-io/random";

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
    publicKey:
      "-----BEGIN RSA PUBLIC KEY-----\n" +
      "MIGJAoGBAKdVz2lIbQi1YU3Z0qRizpV9gAMW9Kmwms4aP+r7CKcu4w9/fMcV4v6P\n" +
      "zYHwnjvTEZ6gSqtxcpwT6EgBAgxFolqjeInOis2I+tcfxcShwcfMZ/E7kgktP15w\n" +
      "dsAFDTzmso9VtnBNgbt8afNea1nK25Fa+Zq+gztxkI5pkw1WFm4FAgMBAAE=\n" +
      "-----END RSA PUBLIC KEY-----\n",
    trusted: true,
    uniqueId: randomString(32),
    ...options,
  });
