import { EcKit } from "@lindorm/ec";
import { IKryptos } from "@lindorm/kryptos";
import { OctKit } from "@lindorm/oct";
import { OkpKit } from "@lindorm/okp";
import { RsaKit } from "@lindorm/rsa";
import { B64U } from "../../constants/private";
import { JwtError } from "../../errors";

type Options = {
  header: string;
  payload: string;
  kryptos: IKryptos;
};

const signEc = (kryptos: IKryptos, data: string): string => {
  const kit = new EcKit({ kryptos, format: "raw" });
  return kit.sign(data);
};

const signOct = (kryptos: IKryptos, data: string): string => {
  const kit = new OctKit({ kryptos, format: B64U });
  return kit.sign(data);
};

const signOkp = (kryptos: IKryptos, data: string): string => {
  const kit = new OkpKit({ kryptos, format: B64U });
  return kit.sign(data);
};

const signRsa = (kryptos: IKryptos, data: string): string => {
  const kit = new RsaKit({ kryptos, format: B64U });
  return kit.sign(data);
};

export const createTokenSignature = (options: Options): string => {
  const data = `${options.header}.${options.payload}`;

  switch (options.kryptos.type) {
    case "EC":
      return signEc(options.kryptos, data);

    case "oct":
      return signOct(options.kryptos, data);

    case "OKP":
      return signOkp(options.kryptos, data);

    case "RSA":
      return signRsa(options.kryptos, data);

    default:
      throw new JwtError("Unsupported algorithm");
  }
};
