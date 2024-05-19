import { EcKit } from "@lindorm/ec";
import { IKryptos } from "@lindorm/kryptos";
import { OctKit } from "@lindorm/oct";
import { OkpKit } from "@lindorm/okp";
import { RsaKit } from "@lindorm/rsa";
import { JwtError } from "../../errors";

type Options = {
  header: string;
  payload: string;
  kryptos: IKryptos;
};

const _signEc = (kryptos: IKryptos, data: string): string => {
  const kit = new EcKit({ kryptos, format: "raw" });
  return kit.sign(data);
};

const _signOct = (kryptos: IKryptos, data: string): string => {
  const kit = new OctKit({ kryptos, format: "base64url" });
  return kit.sign(data);
};

const _signOkp = (kryptos: IKryptos, data: string): string => {
  const kit = new OkpKit({ kryptos, format: "base64url" });
  return kit.sign(data);
};

const _signRsa = (kryptos: IKryptos, data: string): string => {
  const kit = new RsaKit({ kryptos, format: "base64url" });
  return kit.sign(data);
};

export const _createTokenSignature = (options: Options): string => {
  const data = `${options.header}.${options.payload}`;

  switch (options.kryptos.type) {
    case "EC":
      return _signEc(options.kryptos, data);

    case "oct":
      return _signOct(options.kryptos, data);

    case "OKP":
      return _signOkp(options.kryptos, data);

    case "RSA":
      return _signRsa(options.kryptos, data);

    default:
      throw new JwtError("Unsupported algorithm");
  }
};
