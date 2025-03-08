import { IKryptos } from "@lindorm/kryptos";
import { AmphoraConfig, AmphoraJwks, AmphoraQuery } from "../types";

export interface IAmphora {
  config: Array<AmphoraConfig>;
  issuer: string | null;
  jwks: AmphoraJwks;
  vault: Array<IKryptos>;

  add(kryptos: Array<IKryptos> | IKryptos): void;
  filter(query: AmphoraQuery): Promise<Array<IKryptos>>;
  find(query: AmphoraQuery): Promise<IKryptos>;
  refresh(): Promise<void>;
  setup(): Promise<void>;

  canEncrypt(): boolean;
  canDecrypt(): boolean;

  canSign(): boolean;
  canVerify(): boolean;
}
