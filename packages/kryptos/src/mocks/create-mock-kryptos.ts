import type { IKryptos } from "../interfaces/index.js";

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
    internal: true,
    issuer: null,
    jwksUri: null,
    notBefore: new Date("2000-01-01T00:00:00.000Z"),
    ownerId: null,
    // `true`, unlike the constructor default: the mock stands in for an ordinary
    // vault resident, and amphora filters `publish: true` by default — a mock that
    // defaulted to `false` would be invisible to `find()` in every consumer's
    // tests. Override it to model an internal key.
    publish: true,
    purpose: null,
    type: "EC",
    use: "enc",

    // Metadata, not an attribute — the real class DERIVES this from `type`, so it
    // must stay consistent with the mock's declared type ("EC" ⇒ asymmetric).
    algClass: "asymmetric",
    certificateThumbprint: null,
    expiresIn: 999999999,
    hasCertificate: false,
    hasPrivateKey: true,
    hasPublicKey: true,
    isActive: true,
    isPending: false,
    isExpired: false,
    modulus: null,
    // Metadata, not an attribute — the real class DERIVES this from the key
    // material, so the mock must report what an ECDH-ES key actually can do.
    operations: ["deriveKey", "deriveBits"],
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
