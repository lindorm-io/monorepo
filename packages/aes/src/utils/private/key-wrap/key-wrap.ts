import { AesError } from "../../../errors";
import {
  KeyUnwrapOptions,
  KeyUnwrapResult,
  KeyWrapOptions,
  KeyWrapResult,
} from "../../../types/private";
import { _ecbKeyUnwrap, _ecbKeyWrap } from "./ecb-key-wrap";
import { _gcmKeyUnwrap, _gcmKeyWrap } from "./gcm-key-wrap";

export const _keyWrap = (options: KeyWrapOptions): KeyWrapResult => {
  switch (options.kryptos.algorithm) {
    case "A128KW":
    case "A192KW":
    case "A256KW":
    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW":
      return _ecbKeyWrap(options);

    case "A128GCMKW":
    case "A192GCMKW":
    case "A256GCMKW":
    case "ECDH-ES+A128GCMKW":
    case "ECDH-ES+A192GCMKW":
    case "ECDH-ES+A256GCMKW":
      return _gcmKeyWrap(options);

    default:
      throw new AesError("Unsupported key wrap algorithm");
  }
};

export const _keyUnwrap = (options: KeyUnwrapOptions): KeyUnwrapResult => {
  switch (options.kryptos.algorithm) {
    case "A128KW":
    case "A192KW":
    case "A256KW":
    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW":
      return _ecbKeyUnwrap(options);

    case "A128GCMKW":
    case "A192GCMKW":
    case "A256GCMKW":
    case "ECDH-ES+A128GCMKW":
    case "ECDH-ES+A192GCMKW":
    case "ECDH-ES+A256GCMKW":
      return _gcmKeyUnwrap(options);

    default:
      throw new AesError("Unsupported key wrap algorithm");
  }
};
