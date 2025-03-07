import { IKryptos } from "../interfaces";

export const createMockKryptos = (): IKryptos => ({
  id: "9353f654-7cd3-5c91-8a39-96ea7eab1d78",
  algorithm: "ECDH-ES",
  createdAt: new Date("2000-01-01T00:00:00.000Z"),
  curve: "P-521",
  encryption: "A256GCM",
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  isExternal: false,
  issuer: "",
  jwksUri: "",
  notBefore: new Date("2000-01-01T00:00:00.000Z"),
  operations: ["encrypt", "decrypt"],
  ownerId: "",
  type: "EC",
  updatedAt: new Date("2020-01-01T00:00:00.000Z"),
  use: "enc",
  expiresIn: 999999999,
  hasPrivateKey: true,
  hasPublicKey: true,
  isActive: true,
  isExpired: false,
  modulus: undefined,

  toJSON: jest.fn().mockReturnValue({}),
  toJWK: jest.fn().mockReturnValue({}),
  export: jest.fn().mockReturnValue({}),
});
