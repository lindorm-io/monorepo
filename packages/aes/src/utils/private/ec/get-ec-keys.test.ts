import { TEST_EC_KEY } from "../../../__fixtures__/keys";
import { _getEcDecryptionKey, _getEcEncryptionKeys } from "./get-ec-keys";

describe("get-ec-keys", () => {
  test("should return encryption keys", () => {
    expect(
      _getEcEncryptionKeys({
        encryption: "aes-256-gcm",
        kryptos: TEST_EC_KEY,
      }),
    ).toEqual({
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
        publicEncryptionJwk: {
          crv: "P-521",
          x: "ALYAPxQI9-VaHz4jacSrDlu2RL7AubK8NTB3b5EG4KE1WRBa-SBoSec6O3cD3kWWw4IA4B6MgJzm_Qsss3QzHvW-",
          y: "AX24-JHetceSWC-nhNolARHasMWbUpzKdbpx-NlfzKRBm3SpJ05PkP6ecoYciRm0oMownoOlb48ZY1FDpuw0h8zR",
          kty: "EC",
        },
        kryptos: TEST_EC_KEY,
      }),
    ).toEqual(Buffer.from("y651pwp6vfamSSFKCQeU+seiemgNMwAAbBhCWDH0aeM=", "base64"));
  });
});
