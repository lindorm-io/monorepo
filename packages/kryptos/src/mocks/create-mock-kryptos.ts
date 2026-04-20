import { IKryptos } from "../interfaces";

export const _createMockKryptos = (
  mockFn: () => any,
  overrides: Partial<IKryptos> = {},
): IKryptos => {
  const returns = (value: any) => {
    const m = mockFn();
    m.mockReturnValue(value);
    return m;
  };

  return {
    id: "9353f654-7cd3-5c91-8a39-96ea7eab1d78",
    algorithm: "ECDH-ES",
    certificateChain: [],
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

    certificateThumbprint: null,
    expiresIn: 999999999,
    hasCertificate: false,
    hasPrivateKey: true,
    hasPublicKey: true,
    isActive: true,
    isExpired: false,
    modulus: null,
    thumbprint: "mock-thumbprint",
    certificate: null,

    dispose: mockFn(),
    [Symbol.dispose]: mockFn(),
    verifyCertificate: mockFn(),
    toDB: returns({}),
    toEnvString: returns("kryptos:mock"),
    toJSON: returns({}),
    toJWK: returns({}),
    toString: returns("Kryptos<EC:ECDH-ES:mock>"),
    export: returns({}),

    ...overrides,
  } as unknown as IKryptos;
};
