import { EcKit } from "@lindorm/ec";
import { IKryptos } from "@lindorm/kryptos";
import { OctKit } from "@lindorm/oct";
import { OkpKit } from "@lindorm/okp";
import { RsaKit } from "@lindorm/rsa";
import { _B64U } from "../../constants/private/format";
import { JwtError } from "../../errors";

const _verifyEc = (kryptos: IKryptos, data: string, signature: string): boolean => {
  const kit = new EcKit({ kryptos, format: "raw" });
  return kit.verify(data, signature);
};

const _verifyOct = (kryptos: IKryptos, data: string, signature: string): boolean => {
  const kit = new OctKit({ kryptos, format: _B64U });
  return kit.verify(data, signature);
};

const _verifyOkp = (kryptos: IKryptos, data: string, signature: string): boolean => {
  const kit = new OkpKit({ kryptos, format: _B64U });
  return kit.verify(data, signature);
};

const _verifyRsa = (kryptos: IKryptos, data: string, signature: string): boolean => {
  const kit = new RsaKit({ kryptos, format: _B64U });
  return kit.verify(data, signature);
};

export const _verifyTokenSignature = (kryptos: IKryptos, token: string): boolean => {
  const [header, payload, signature] = token.split(".");
  const data = `${header}.${payload}`;

  switch (kryptos.type) {
    case "EC":
      return _verifyEc(kryptos, data, signature);

    case "oct":
      return _verifyOct(kryptos, data, signature);

    case "OKP":
      return _verifyOkp(kryptos, data, signature);

    case "RSA":
      return _verifyRsa(kryptos, data, signature);

    default:
      throw new JwtError("Unsupported algorithm");
  }
};
