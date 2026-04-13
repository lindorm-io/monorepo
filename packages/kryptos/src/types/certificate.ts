import type { IKryptos } from "../interfaces/Kryptos";

export type KryptosCertificateOption =
  | {
      mode: "self-signed";
      subject?: string;
      organization?: string;
      subjectAlternativeNames?: ReadonlyArray<string>;
    }
  | {
      mode: "ca-signed";
      ca: IKryptos;
      subject?: string;
      organization?: string;
      subjectAlternativeNames?: ReadonlyArray<string>;
    };
