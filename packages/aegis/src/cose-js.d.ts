// Minimal ambient declaration for the untyped `cose-js` package (erdtman),
// used only by the COSE interop tests as a second independent reference impl
// alongside `@auth0/cose` (the COSE analogue of `jose` + `jsonwebtoken`).
declare module "cose-js" {
  type CoseHeaders = { p?: Record<string, unknown>; u?: Record<string, unknown> };
  type CoseSigner = { key: Record<string, Buffer | undefined>; externalAAD?: Buffer };

  export const sign: {
    create(
      headers: CoseHeaders,
      payload: Buffer,
      signer: CoseSigner,
      options?: Record<string, unknown>,
    ): Promise<Buffer>;
    verify(
      payload: Buffer,
      verifier: CoseSigner,
      options?: Record<string, unknown>,
    ): Promise<Buffer>;
  };
}
