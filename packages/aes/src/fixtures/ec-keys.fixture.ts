import { EcJwkValues, EcPemValues } from "@lindorm-io/jwk";

export const PRIVATE_EC_PEM: EcPemValues = {
  id: "dfa05b8c-b003-5ada-8a91-5bc6ce95c654",
  curve: "P-521",
  privateKey:
    "-----BEGIN PRIVATE KEY-----\n" +
    "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIAmT5i0eE+ihtF0Rlf\n" +
    "Mr1REhPuYHt28Zh4fpOYryQ/Todr+VVFfx//MP29z0JGKT59vpeRxMzGS0U297Ve\n" +
    "Srcdsy6hgYkDgYYABAALCbX3YEpmksbJtbMDkgqHZksXhMMUNb3HZC1ckqWQBi3B\n" +
    "mWDSLyfXFLUBkHPUtwg745EdG5K8auBy2KguCsKHcwCXEjKSVpmfe4L9N4FyCGx+\n" +
    "e6dNUTegqVXFE11vrODcZ0OlA4blinsgXQexdeK10GUCob5bqBqY77+jjeG3ZNsL\n" +
    "lg==\n" +
    "-----END PRIVATE KEY-----\n",
  publicKey:
    "-----BEGIN PUBLIC KEY-----\n" +
    "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQACwm192BKZpLGybWzA5IKh2ZLF4TD\n" +
    "FDW9x2QtXJKlkAYtwZlg0i8n1xS1AZBz1LcIO+ORHRuSvGrgctioLgrCh3MAlxIy\n" +
    "klaZn3uC/TeBcghsfnunTVE3oKlVxRNdb6zg3GdDpQOG5Yp7IF0HsXXitdBlAqG+\n" +
    "W6gamO+/o43ht2TbC5Y=\n" +
    "-----END PUBLIC KEY-----\n",
  type: "EC",
};

export const PUBLIC_EC_PEM: EcPemValues = {
  id: "dfa05b8c-b003-5ada-8a91-5bc6ce95c654",
  curve: "P-521",
  publicKey:
    "-----BEGIN PUBLIC KEY-----\n" +
    "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQACwm192BKZpLGybWzA5IKh2ZLF4TD\n" +
    "FDW9x2QtXJKlkAYtwZlg0i8n1xS1AZBz1LcIO+ORHRuSvGrgctioLgrCh3MAlxIy\n" +
    "klaZn3uC/TeBcghsfnunTVE3oKlVxRNdb6zg3GdDpQOG5Yp7IF0HsXXitdBlAqG+\n" +
    "W6gamO+/o43ht2TbC5Y=\n" +
    "-----END PUBLIC KEY-----\n",
  type: "EC",
};

export const PRIVATE_EC_JWK: EcJwkValues = {
  crv: "P-521",
  d: "AJk+YtHhPoobRdEZXzK9URIT7mB7dvGYeH6TmK8kP06Ha/lVRX8f/zD9vc9CRik+fb6XkcTMxktFNve1Xkq3HbMu",
  x: "AAsJtfdgSmaSxsm1swOSCodmSxeEwxQ1vcdkLVySpZAGLcGZYNIvJ9cUtQGQc9S3CDvjkR0bkrxq4HLYqC4Kwodz",
  y: "AJcSMpJWmZ97gv03gXIIbH57p01RN6CpVcUTXW+s4NxnQ6UDhuWKeyBdB7F14rXQZQKhvluoGpjvv6ON4bdk2wuW",
  kid: "dfa05b8c-b003-5ada-8a91-5bc6ce95c654",
  kty: "EC",
};

export const PUBLIC_EC_JWK: EcJwkValues = {
  crv: "P-521",
  x: "AAsJtfdgSmaSxsm1swOSCodmSxeEwxQ1vcdkLVySpZAGLcGZYNIvJ9cUtQGQc9S3CDvjkR0bkrxq4HLYqC4Kwodz",
  y: "AJcSMpJWmZ97gv03gXIIbH57p01RN6CpVcUTXW+s4NxnQ6UDhuWKeyBdB7F14rXQZQKhvluoGpjvv6ON4bdk2wuW",
  kid: "dfa05b8c-b003-5ada-8a91-5bc6ce95c654",
  kty: "EC",
};
