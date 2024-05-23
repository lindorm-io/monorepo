import { EcKit } from "@lindorm/ec";
import { IKryptos } from "@lindorm/kryptos";
import { OctKit } from "@lindorm/oct";
import { OkpKit } from "@lindorm/okp";
import { RsaKit } from "@lindorm/rsa";
import { B64U } from "../../constants/private/format";
import { JwtError } from "../../errors";

const verifyEc = (kryptos: IKryptos, data: string, signature: string): boolean => {
  const kit = new EcKit({ kryptos, format: "raw" });
  return kit.verify(data, signature);
};

const verifyOct = (kryptos: IKryptos, data: string, signature: string): boolean => {
  const kit = new OctKit({ kryptos, format: B64U });
  return kit.verify(data, signature);
};

const verifyOkp = (kryptos: IKryptos, data: string, signature: string): boolean => {
  const kit = new OkpKit({ kryptos, format: B64U });
  return kit.verify(data, signature);
};

const verifyRsa = (kryptos: IKryptos, data: string, signature: string): boolean => {
  const kit = new RsaKit({ kryptos, format: B64U });
  return kit.verify(data, signature);
};

export const verifyTokenSignature = (kryptos: IKryptos, token: string): boolean => {
  const [header, payload, signature] = token.split(".");
  const data = `${header}.${payload}`;

  switch (kryptos.type) {
    case "EC":
      return verifyEc(kryptos, data, signature);

    case "oct":
      return verifyOct(kryptos, data, signature);

    case "OKP":
      return verifyOkp(kryptos, data, signature);

    case "RSA":
      return verifyRsa(kryptos, data, signature);

    default:
      throw new JwtError("Unsupported algorithm");
  }
};
