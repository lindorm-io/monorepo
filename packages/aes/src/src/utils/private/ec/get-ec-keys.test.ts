import { EC_KEY_SET } from "../../../__fixtures__/ec-keys.fixture";
import { _getEcDecryptionKey, _getEcEncryptionKeys } from "./get-ec-keys";

describe("get-ec-keys", () => {
  test("should return encryption keys", () => {
    expect(
      _getEcEncryptionKeys({
        encryption: "aes-256-gcm",
        encryptionKeyAlgorithm: "ECDH-ES",
        kryptos: EC_KEY_SET,
      }),
    ).toStrictEqual({
      encryptionKey: expect.any(Buffer),
      publicEncryptionJwk: {
        crv: "P-521",
        x: expect.any(String),
        y: expect.any(String),
        kty: "EC",
      },
    });
  });

  test("should return decryption key", () => {
    expect(
      _getEcDecryptionKey({
        encryption: "aes-256-gcm",
        kryptos: EC_KEY_SET,
        publicEncryptionJwk: {
          crv: "P-521",
          x: "ALYAPxQI9-VaHz4jacSrDlu2RL7AubK8NTB3b5EG4KE1WRBa-SBoSec6O3cD3kWWw4IA4B6MgJzm_Qsss3QzHvW-",
          y: "AX24-JHetceSWC-nhNolARHasMWbUpzKdbpx-NlfzKRBm3SpJ05PkP6ecoYciRm0oMownoOlb48ZY1FDpuw0h8zR",
          kty: "EC",
        },
      }),
    ).toStrictEqual(
      Buffer.from("4ddde4b3352815587593d7f7df124930332ceef9ed62225794e6276ed3f4b1dc", "hex"),
    );
  });
});
