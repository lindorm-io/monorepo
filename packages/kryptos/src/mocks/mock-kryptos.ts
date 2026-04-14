import { IKryptos } from "../interfaces";

export type MockKryptos = jest.Mocked<IKryptos>;

export const createMockKryptos = (overrides: Partial<MockKryptos> = {}): MockKryptos => ({
  id: "9353f654-7cd3-5c91-8a39-96ea7eab1d78",
  algorithm: "ECDH-ES",
  certificateChain: [],
  certificateThumbprint: null,
  createdAt: new Date("2000-01-01T00:00:00.000Z"),
  curve: "P-521",
  encryption: "A256GCM",
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  hidden: false,
  isExternal: false,
  issuer: null,
  jwksUri: null,
  notBefore: new Date("2000-01-01T00:00:00.000Z"),
  operations: ["encrypt", "decrypt"],
  ownerId: null,
  purpose: null,
  type: "EC",
  use: "enc",

  expiresIn: 999999999,
  hasPrivateKey: true,
  hasPublicKey: true,
  isActive: true,
  isExpired: false,
  modulus: null,
  thumbprint: "mock-thumbprint",
  hasCertificate: false,
  certificate: null,

  dispose: jest.fn(),
  [Symbol.dispose]: jest.fn(),
  verifyCertificate: jest.fn(),
  toDB: jest.fn().mockReturnValue({}),
  toEnvString: jest.fn().mockReturnValue("kryptos:mock"),
  toJSON: jest.fn().mockReturnValue({}),
  toJWK: jest.fn().mockReturnValue({}),
  toString: jest.fn().mockReturnValue("Kryptos<EC:ECDH-ES:mock>"),
  export: jest.fn().mockReturnValue({}),

  ...overrides,
});
