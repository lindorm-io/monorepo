import MockDate from "mockdate";
import {
  TEST_RSA_KEY_B64,
  TEST_RSA_KEY_JWK,
  TEST_RSA_KEY_PEM,
} from "../__fixtures__/rsa-keys";
import { KryptosKit } from "./KryptosKit";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: jest.fn().mockReturnValue("6e6f84b0-e125-5e3f-90ae-c65269668d98"),
}));

describe("KryptosKit (EC)", () => {
  describe("clone", () => {
    test("should clone", () => {
      const kryptos = KryptosKit.from.auto(TEST_RSA_KEY_B64);
      const cloned = KryptosKit.clone(kryptos);

      expect(cloned.toJSON()).toEqual(kryptos.toJSON());
      expect(cloned.toJWK()).toEqual(kryptos.toJWK());
      expect(cloned.export("b64")).toEqual(kryptos.export("b64"));
    });
  });

  describe("env", () => {
    test("import", () => {
      const kryptos = KryptosKit.env.import(
        "kryptos:6e6f84b0-e125-5e3f-90ae-c65269668d98.RS512....MIIJKQIBAAKCAgEA7cxLHoxaHdYU8EX2ij5m42XIQYWBUxKMOfVbV2OX0nNHEdojXfRfONvrAHwsvRqcdN44yv1E1be18qs5HRB67D3qLeRjXcjegdjWvQj66IFVZIxQHNJ-LXDbAYs7gez8RYbBObnDzfrqy9vIPZet1tbqvlxv9aTR38x3ORJ4Y6Ym9StbKOUIo7BLIvoc1M5uNUIEnFKKZhbmVR423-F50w_E0618KExZgeur_8cMsSWZxyl0oeSI-rIodjfVJbshT1yy98zKRj-mMnyPKgHQARr9SwDA5Xlt9L2fVZ72xgwaPOBUgFoDTPQsqQ3Rkj7nYUSqwQVEL0-oH2K7U3OeGeKyIQMNzRdSfYMw3gSc5dtwqX64oK33lN2jzTKa0clSZjqJ4jzUL1YrXMddF07dMQqjN2mGjeZVy5LaO4B58Y5l-kO01KdwA-_LcDhkNgbKiZMZVtNPlVkR3nCvInt5cqPOqMOcLW3oA1wmh7zauWqorklpSSs75zw8ETtzATSJv8h7kUG9Bl1QQgdBkGqKb4ZG-r5Bj6pwJrHVmgPSMowP8P9G13iQLFdKX714A3DMKDc03TJvs2yVK81YUCtO5aRdwb0q0YcFqn9BHI3cmO-kOhXquMakPQ3zW_FBSnIeBhJMObCQOmYEuZxrifMcCQTY7j5jsP962e7ZPn53STcCAwEAAQKCAgArosNeFa8rrm8lMBFviMfkjnbS3ya-Ebc9o3JhdNsVOSYfdoHq6b7XdjOHYUHsaYewQl71kMgi15VBtH3EgZOs6iegyDobqZJ7DUlKYu134NPEoaLJxy50NDNb8yq2SsB4GaQ3bYkqsRKI2gnCk6TIuaNVzyyUTOxePuzZwjPpRUH81znhJTYSo3UGNBM6Ua8TgsvJy7OtzCH0GJlFN-DdBBXAKiOQWYJLPu3O_72qfBXd4BOQ6ZjhN_QIzXIFfHM-VupYYnHzthZPSWAT-0UqDsPQEZFUCpZMxMcKNSNfcDUYWqnm652Tb3MKioicZ4KZ7LnQtaCvddSJ_doWFC88gjf2CFVdB7XlL2qkK6jY7tQXAJ4NAZwZo7PtIHf3lTvD8jI6a1ANf_MEb2Ww-ZNJHVw8ht0SB-ucLJtllyNesTc9MwyLdwp8864KK2TBT3V2h0h9ksySTB6oqWYY4tghz4mZmH95GvttORqVeJXExNMhrouI7-nbTJa6QInFb7ZGeRg3aV0GcNTQfYmEpCuwPz5hFz_MGcslDZMyvDraE3C1XYMNWg0Pewm7RII4xR0fQqZ8iSkE8RnjeyYJQv17R8b-rTTgFt2a3yri9Xy2t1gX-fP776jK5qx7T1wnsJ_6qao1aqwBuLpk1HTi1YJBqvc57DXRnN9m2cPeM351gQKCAQEA-chzifBq71q8mETLfBQjWh5kKkVUdaaSuZ02lyMhziR8iZAsF0R08SFP2XWlOJrRGvLBItul787MurOI4VLhOSF-y5CZufSxHO-xDsZTDGD-GxYWAuLcdshcSl4HyJ4SZs13u3FUNVJeINC6IY4kn8iWHnPUbUHtu4kKvd-0t6hYxUB36wb_4fUjnQnghjtSJK23oeoArQ7ZDA0hApC3fPE2g5oQDkGqWDd1Smrmz3XlAZTMK9vqUlGHZRhaqC-dBhptLGSUulwrncEqsYKlW7NYppAWgHAY40wRy5Yglpv9GOhtJfUqkm7mQsmLhVw-1GtGc7Mi8sP3Nn-03mcqoQKCAQEA87d6H0DGvJNNLCZdlexp9Q84PpZYMMy-4JjbOpZh6qyhvclgXnkwXk0uo7G1dI5a--Eggft6_nQs8qQ-2bbtJ3V6BAECnEsWPJeWmeiMFEf0L51P0MMf_AY5Y4XOLCE6A3TieuH4NJ0iWMIZqYkCEYIqGTjR3TWNkSzQGJaewKpDu1m95dZCIbXGMXc0Tg6QJF0DIRdpqSQw5QAyLFmSQYLudjds688te-s63g02W_xLeUgKOKd-zsMY_xnubElXaEXVItBtgpbPoMqz6DGr92uNTpKUO3Wb2swIHhoMKp5G7XNQzSlsHLnEjwbz8m4xMXlCZDfx_-ukJ0iNFlz81wKCAQEAqxYylUO4axPSY9WTLvy4Lizs3Ms6C4-5pitZzfHBYOo65xp6KMG5-8OeZsufDIN2QKgPw-mA4h3auvLoCbX0EGax64qy0N0aR0CiHQWYsrzor_LTxsxOx4l7NXDskew7nHCV1yzLye4ODRoKs5sh2NPShy89TEzBIhe-5MkKhlVn4EvFF5VmxQVcjF7MjASrwfW-9sdKCT9HSWrgtlobZBfwB_oJj0pI_D2YOA265FTTM98QbeYmvJWdUJB64AIk4p5NMv_9oxwov9gkfwuGaaYRTZ0Z3IVrdpyO_8xnq-FSXbItuLcRntUZIJvd1c2WN3b2_Z6wjGnPtWOJpmAxoQKCAQAdD-kBJxFL1WjjdeO9CAcOkPUNCZKUpyWv1Kp3zwz4FgPnhMb4HQ12gU-pd3yC3KLe3FarCVj-VM4zVQClp5maFfkp1xD_oDiTmyP7UG670GS-9MxawZnjzL41LvSJ8KBhXyPOsXmOlJpO6T50KAFWIyZwAYWNEmDCSgy6keN2aBdRlP7_FFCogmuS5HsZP8VSgMDpxkf0QnuOIzrYbQnyw_E5qZxUdk0fNMq9RegQigJaAQwu-1I0x7EIYog643gH2CP1VdNpOiCiNOnFK38tLucX0oTYnkqqiaACLur6fgtJL3IYNPNObZyRzatzYk59bs9K8hzqfqgBgzZHz2jbAoIBAQCmSl--lhVQbwXWjJMoXQYwZB7iLVXAgZDgzjStZlQ_nEmYf6v-QTPsPz6UKc5FWylCfWA-5B6_rdRFoX_bkHOYGS5G0peubDhsW8rKwuqCbY9Yfy8EM44D559NRW29J0eVDVpRhEtY3j_YqFZD9n5fS-VhMbKO1hZCMQK_kI4CuJ1q8TaIx-L69Yl7UtYHnmtyatuHaNzfx6cw10PZIn0YxB5OFl5bmKYKVqHw0JD_CozWoKAhUfbYS55K3DGfh2jJtGpdyOq8VS-e8H14C_GZxdwN1Umi7dzvOcHd-_xi_3DcHEwNLtkDhkCeWlE3PQs0Cu5yWl3NlaFVrRmN9csJ.MIICCgKCAgEA7cxLHoxaHdYU8EX2ij5m42XIQYWBUxKMOfVbV2OX0nNHEdojXfRfONvrAHwsvRqcdN44yv1E1be18qs5HRB67D3qLeRjXcjegdjWvQj66IFVZIxQHNJ-LXDbAYs7gez8RYbBObnDzfrqy9vIPZet1tbqvlxv9aTR38x3ORJ4Y6Ym9StbKOUIo7BLIvoc1M5uNUIEnFKKZhbmVR423-F50w_E0618KExZgeur_8cMsSWZxyl0oeSI-rIodjfVJbshT1yy98zKRj-mMnyPKgHQARr9SwDA5Xlt9L2fVZ72xgwaPOBUgFoDTPQsqQ3Rkj7nYUSqwQVEL0-oH2K7U3OeGeKyIQMNzRdSfYMw3gSc5dtwqX64oK33lN2jzTKa0clSZjqJ4jzUL1YrXMddF07dMQqjN2mGjeZVy5LaO4B58Y5l-kO01KdwA-_LcDhkNgbKiZMZVtNPlVkR3nCvInt5cqPOqMOcLW3oA1wmh7zauWqorklpSSs75zw8ETtzATSJv8h7kUG9Bl1QQgdBkGqKb4ZG-r5Bj6pwJrHVmgPSMowP8P9G13iQLFdKX714A3DMKDc03TJvs2yVK81YUCtO5aRdwb0q0YcFqn9BHI3cmO-kOhXquMakPQ3zW_FBSnIeBhJMObCQOmYEuZxrifMcCQTY7j5jsP962e7ZPn53STcCAwEAAQ..RSA.sig",
      );

      expect(kryptos.export("b64")).toEqual(TEST_RSA_KEY_B64);
    });

    test("export", () => {
      const kryptos = KryptosKit.from.auto(TEST_RSA_KEY_B64);

      expect(KryptosKit.env.export(kryptos)).toEqual(
        "kryptos:6e6f84b0-e125-5e3f-90ae-c65269668d98.RS512....MIIJKQIBAAKCAgEA7cxLHoxaHdYU8EX2ij5m42XIQYWBUxKMOfVbV2OX0nNHEdojXfRfONvrAHwsvRqcdN44yv1E1be18qs5HRB67D3qLeRjXcjegdjWvQj66IFVZIxQHNJ-LXDbAYs7gez8RYbBObnDzfrqy9vIPZet1tbqvlxv9aTR38x3ORJ4Y6Ym9StbKOUIo7BLIvoc1M5uNUIEnFKKZhbmVR423-F50w_E0618KExZgeur_8cMsSWZxyl0oeSI-rIodjfVJbshT1yy98zKRj-mMnyPKgHQARr9SwDA5Xlt9L2fVZ72xgwaPOBUgFoDTPQsqQ3Rkj7nYUSqwQVEL0-oH2K7U3OeGeKyIQMNzRdSfYMw3gSc5dtwqX64oK33lN2jzTKa0clSZjqJ4jzUL1YrXMddF07dMQqjN2mGjeZVy5LaO4B58Y5l-kO01KdwA-_LcDhkNgbKiZMZVtNPlVkR3nCvInt5cqPOqMOcLW3oA1wmh7zauWqorklpSSs75zw8ETtzATSJv8h7kUG9Bl1QQgdBkGqKb4ZG-r5Bj6pwJrHVmgPSMowP8P9G13iQLFdKX714A3DMKDc03TJvs2yVK81YUCtO5aRdwb0q0YcFqn9BHI3cmO-kOhXquMakPQ3zW_FBSnIeBhJMObCQOmYEuZxrifMcCQTY7j5jsP962e7ZPn53STcCAwEAAQKCAgArosNeFa8rrm8lMBFviMfkjnbS3ya-Ebc9o3JhdNsVOSYfdoHq6b7XdjOHYUHsaYewQl71kMgi15VBtH3EgZOs6iegyDobqZJ7DUlKYu134NPEoaLJxy50NDNb8yq2SsB4GaQ3bYkqsRKI2gnCk6TIuaNVzyyUTOxePuzZwjPpRUH81znhJTYSo3UGNBM6Ua8TgsvJy7OtzCH0GJlFN-DdBBXAKiOQWYJLPu3O_72qfBXd4BOQ6ZjhN_QIzXIFfHM-VupYYnHzthZPSWAT-0UqDsPQEZFUCpZMxMcKNSNfcDUYWqnm652Tb3MKioicZ4KZ7LnQtaCvddSJ_doWFC88gjf2CFVdB7XlL2qkK6jY7tQXAJ4NAZwZo7PtIHf3lTvD8jI6a1ANf_MEb2Ww-ZNJHVw8ht0SB-ucLJtllyNesTc9MwyLdwp8864KK2TBT3V2h0h9ksySTB6oqWYY4tghz4mZmH95GvttORqVeJXExNMhrouI7-nbTJa6QInFb7ZGeRg3aV0GcNTQfYmEpCuwPz5hFz_MGcslDZMyvDraE3C1XYMNWg0Pewm7RII4xR0fQqZ8iSkE8RnjeyYJQv17R8b-rTTgFt2a3yri9Xy2t1gX-fP776jK5qx7T1wnsJ_6qao1aqwBuLpk1HTi1YJBqvc57DXRnN9m2cPeM351gQKCAQEA-chzifBq71q8mETLfBQjWh5kKkVUdaaSuZ02lyMhziR8iZAsF0R08SFP2XWlOJrRGvLBItul787MurOI4VLhOSF-y5CZufSxHO-xDsZTDGD-GxYWAuLcdshcSl4HyJ4SZs13u3FUNVJeINC6IY4kn8iWHnPUbUHtu4kKvd-0t6hYxUB36wb_4fUjnQnghjtSJK23oeoArQ7ZDA0hApC3fPE2g5oQDkGqWDd1Smrmz3XlAZTMK9vqUlGHZRhaqC-dBhptLGSUulwrncEqsYKlW7NYppAWgHAY40wRy5Yglpv9GOhtJfUqkm7mQsmLhVw-1GtGc7Mi8sP3Nn-03mcqoQKCAQEA87d6H0DGvJNNLCZdlexp9Q84PpZYMMy-4JjbOpZh6qyhvclgXnkwXk0uo7G1dI5a--Eggft6_nQs8qQ-2bbtJ3V6BAECnEsWPJeWmeiMFEf0L51P0MMf_AY5Y4XOLCE6A3TieuH4NJ0iWMIZqYkCEYIqGTjR3TWNkSzQGJaewKpDu1m95dZCIbXGMXc0Tg6QJF0DIRdpqSQw5QAyLFmSQYLudjds688te-s63g02W_xLeUgKOKd-zsMY_xnubElXaEXVItBtgpbPoMqz6DGr92uNTpKUO3Wb2swIHhoMKp5G7XNQzSlsHLnEjwbz8m4xMXlCZDfx_-ukJ0iNFlz81wKCAQEAqxYylUO4axPSY9WTLvy4Lizs3Ms6C4-5pitZzfHBYOo65xp6KMG5-8OeZsufDIN2QKgPw-mA4h3auvLoCbX0EGax64qy0N0aR0CiHQWYsrzor_LTxsxOx4l7NXDskew7nHCV1yzLye4ODRoKs5sh2NPShy89TEzBIhe-5MkKhlVn4EvFF5VmxQVcjF7MjASrwfW-9sdKCT9HSWrgtlobZBfwB_oJj0pI_D2YOA265FTTM98QbeYmvJWdUJB64AIk4p5NMv_9oxwov9gkfwuGaaYRTZ0Z3IVrdpyO_8xnq-FSXbItuLcRntUZIJvd1c2WN3b2_Z6wjGnPtWOJpmAxoQKCAQAdD-kBJxFL1WjjdeO9CAcOkPUNCZKUpyWv1Kp3zwz4FgPnhMb4HQ12gU-pd3yC3KLe3FarCVj-VM4zVQClp5maFfkp1xD_oDiTmyP7UG670GS-9MxawZnjzL41LvSJ8KBhXyPOsXmOlJpO6T50KAFWIyZwAYWNEmDCSgy6keN2aBdRlP7_FFCogmuS5HsZP8VSgMDpxkf0QnuOIzrYbQnyw_E5qZxUdk0fNMq9RegQigJaAQwu-1I0x7EIYog643gH2CP1VdNpOiCiNOnFK38tLucX0oTYnkqqiaACLur6fgtJL3IYNPNObZyRzatzYk59bs9K8hzqfqgBgzZHz2jbAoIBAQCmSl--lhVQbwXWjJMoXQYwZB7iLVXAgZDgzjStZlQ_nEmYf6v-QTPsPz6UKc5FWylCfWA-5B6_rdRFoX_bkHOYGS5G0peubDhsW8rKwuqCbY9Yfy8EM44D559NRW29J0eVDVpRhEtY3j_YqFZD9n5fS-VhMbKO1hZCMQK_kI4CuJ1q8TaIx-L69Yl7UtYHnmtyatuHaNzfx6cw10PZIn0YxB5OFl5bmKYKVqHw0JD_CozWoKAhUfbYS55K3DGfh2jJtGpdyOq8VS-e8H14C_GZxdwN1Umi7dzvOcHd-_xi_3DcHEwNLtkDhkCeWlE3PQs0Cu5yWl3NlaFVrRmN9csJ.MIICCgKCAgEA7cxLHoxaHdYU8EX2ij5m42XIQYWBUxKMOfVbV2OX0nNHEdojXfRfONvrAHwsvRqcdN44yv1E1be18qs5HRB67D3qLeRjXcjegdjWvQj66IFVZIxQHNJ-LXDbAYs7gez8RYbBObnDzfrqy9vIPZet1tbqvlxv9aTR38x3ORJ4Y6Ym9StbKOUIo7BLIvoc1M5uNUIEnFKKZhbmVR423-F50w_E0618KExZgeur_8cMsSWZxyl0oeSI-rIodjfVJbshT1yy98zKRj-mMnyPKgHQARr9SwDA5Xlt9L2fVZ72xgwaPOBUgFoDTPQsqQ3Rkj7nYUSqwQVEL0-oH2K7U3OeGeKyIQMNzRdSfYMw3gSc5dtwqX64oK33lN2jzTKa0clSZjqJ4jzUL1YrXMddF07dMQqjN2mGjeZVy5LaO4B58Y5l-kO01KdwA-_LcDhkNgbKiZMZVtNPlVkR3nCvInt5cqPOqMOcLW3oA1wmh7zauWqorklpSSs75zw8ETtzATSJv8h7kUG9Bl1QQgdBkGqKb4ZG-r5Bj6pwJrHVmgPSMowP8P9G13iQLFdKX714A3DMKDc03TJvs2yVK81YUCtO5aRdwb0q0YcFqn9BHI3cmO-kOhXquMakPQ3zW_FBSnIeBhJMObCQOmYEuZxrifMcCQTY7j5jsP962e7ZPn53STcCAwEAAQ..RSA.sig",
      );
    });
  });

  describe("from", () => {
    describe("auto", () => {
      test("b64", () => {
        const kryptos = KryptosKit.from.auto(TEST_RSA_KEY_B64);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("b64")).toMatchSnapshot();
      });

      test("jwk", () => {
        const kryptos = KryptosKit.from.auto(TEST_RSA_KEY_JWK);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("jwk")).toMatchSnapshot();
      });

      test("pem", () => {
        const kryptos = KryptosKit.from.auto(TEST_RSA_KEY_PEM);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("pem")).toMatchSnapshot();
      });
    });

    test("b64", () => {
      const kryptos = KryptosKit.from.b64(TEST_RSA_KEY_B64);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("b64")).toMatchSnapshot();
    });

    test("jwk", () => {
      const kryptos = KryptosKit.from.jwk(TEST_RSA_KEY_JWK);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("jwk")).toMatchSnapshot();
    });

    test("pem", () => {
      const kryptos = KryptosKit.from.pem(TEST_RSA_KEY_PEM);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("pem")).toMatchSnapshot();
    });
  });

  describe("is", () => {
    test("isEc", () => {
      const kryptos = KryptosKit.from.b64(TEST_RSA_KEY_B64);

      expect(KryptosKit.isEc(kryptos)).toBe(false);
    });

    test("isOct", () => {
      const kryptos = KryptosKit.from.b64(TEST_RSA_KEY_B64);

      expect(KryptosKit.isOct(kryptos)).toBe(false);
    });

    test("isOkp", () => {
      const kryptos = KryptosKit.from.b64(TEST_RSA_KEY_B64);

      expect(KryptosKit.isOkp(kryptos)).toBe(false);
    });

    test("isRsa", () => {
      const kryptos = KryptosKit.from.b64(TEST_RSA_KEY_B64);

      expect(KryptosKit.isRsa(kryptos)).toBe(true);
    });
  });

  describe("make", () => {
    test("auto", () => {
      const kryptos = KryptosKit.make.auto({
        algorithm: "PS384",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        algorithm: "PS384",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "RSA",
        use: "sig",
      });
    });

    test("enc", () => {
      const kryptos = KryptosKit.make.enc.rsa({
        algorithm: "RSA-OAEP-384",
        encryption: "A256GCM",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        algorithm: "RSA-OAEP-384",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "RSA",
        use: "enc",
      });
    });

    test("sig", () => {
      const kryptos = KryptosKit.make.sig.rsa({
        algorithm: "RS256",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        algorithm: "RS256",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "RSA",
        use: "sig",
      });
    });
  });
});
