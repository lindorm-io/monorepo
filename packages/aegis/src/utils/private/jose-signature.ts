import { IKryptos } from "@lindorm/kryptos";
import { SignatureKit } from "../../classes";
import { B64U } from "../../constants/private";

type Options = {
  header: string;
  payload: string;
  kryptos: IKryptos;
};

export const createJoseSignature = (options: Options): string => {
  const data = `${options.header}.${options.payload}`;

  return new SignatureKit({ kryptos: options.kryptos, raw: true })
    .sign(data)
    .toString(B64U);
};

export const verifyJoseSignature = (kryptos: IKryptos, token: string): boolean => {
  const [header, payload, signature] = token.split(".");
  const data = `${header}.${payload}`;

  return new SignatureKit({ kryptos, encoding: B64U, raw: true }).verify(data, signature);
};
