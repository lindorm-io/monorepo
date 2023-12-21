import { createSign, createVerify } from "crypto";
import { decodeEC, encodeEC } from "./ec";

const sign = (privateKey: string, input: string) => {
  const createdSign = createSign("sha512");
  createdSign.write(input);
  createdSign.end();
  return createdSign.sign({ key: privateKey }, "base64");
};

const verify = (publicKey: string, input: string, signature: string) => {
  const createdVerify = createVerify("sha512");
  createdVerify.write(input);
  createdVerify.end();
  return createdVerify.verify({ key: publicKey }, signature, "base64");
};

describe("ec", () => {
  const curve = "P-521";

  const privateKey =
    "-----BEGIN PRIVATE KEY-----\n" +
    "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIAmT5i0eE+ihtF0Rlf\n" +
    "Mr1REhPuYHt28Zh4fpOYryQ/Todr+VVFfx//MP29z0JGKT59vpeRxMzGS0U297Ve\n" +
    "Srcdsy6hgYkDgYYABAALCbX3YEpmksbJtbMDkgqHZksXhMMUNb3HZC1ckqWQBi3B\n" +
    "mWDSLyfXFLUBkHPUtwg745EdG5K8auBy2KguCsKHcwCXEjKSVpmfe4L9N4FyCGx+\n" +
    "e6dNUTegqVXFE11vrODcZ0OlA4blinsgXQexdeK10GUCob5bqBqY77+jjeG3ZNsL\n" +
    "lg==\n" +
    "-----END PRIVATE KEY-----\n";

  const publicKey =
    "-----BEGIN PUBLIC KEY-----\n" +
    "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQACwm192BKZpLGybWzA5IKh2ZLF4TD\n" +
    "FDW9x2QtXJKlkAYtwZlg0i8n1xS1AZBz1LcIO+ORHRuSvGrgctioLgrCh3MAlxIy\n" +
    "klaZn3uC/TeBcghsfnunTVE3oKlVxRNdb6zg3GdDpQOG5Yp7IF0HsXXitdBlAqG+\n" +
    "W6gamO+/o43ht2TbC5Y=\n" +
    "-----END PUBLIC KEY-----\n";

  const d =
    "AJk+YtHhPoobRdEZXzK9URIT7mB7dvGYeH6TmK8kP06Ha/lVRX8f/zD9vc9CRik+fb6XkcTMxktFNve1Xkq3HbMu";
  const x =
    "AAsJtfdgSmaSxsm1swOSCodmSxeEwxQ1vcdkLVySpZAGLcGZYNIvJ9cUtQGQc9S3CDvjkR0bkrxq4HLYqC4Kwodz";
  const y =
    "AJcSMpJWmZ97gv03gXIIbH57p01RN6CpVcUTXW+s4NxnQ6UDhuWKeyBdB7F14rXQZQKhvluoGpjvv6ON4bdk2wuW";

  test("should encode both keys", () => {
    expect(encodeEC({ privateKey, publicKey, curve })).toStrictEqual({ crv: curve, d, x, y });
  });

  test("should encode public key", () => {
    expect(encodeEC({ publicKey, curve })).toStrictEqual({ crv: curve, x, y });
  });

  test("should decode both keys", () => {
    expect(decodeEC({ d, x, y, crv: curve })).toStrictEqual({ curve, publicKey, privateKey });
  });

  test("should decode public key", () => {
    expect(decodeEC({ x, y, crv: curve })).toStrictEqual({ curve, publicKey });
  });

  test("should resolve a valid public key", () => {
    const { publicKey: decodedPublicKey } = decodeEC({ x, y, crv: curve });
    const signature = sign(privateKey, "input");

    expect(verify(decodedPublicKey!, "input", signature)).toBe(true);
  });

  test("should resolve a valid private key", () => {
    const { privateKey: decodedPrivateKey } = decodeEC({ d, x, y, crv: curve });
    const signature = sign(decodedPrivateKey!, "input");

    expect(verify(publicKey, "input", signature)).toBe(true);
  });
});
