import { IKryptos } from "@lindorm/kryptos";
import { AmphoraConfig, AmphoraJwks, AmphoraQuery } from "../types";

export interface IAmphora {
  config: Array<AmphoraConfig>;
  issuer: string | null;
  jwks: AmphoraJwks;
  vault: Array<IKryptos>;

  add(kryptos: Array<IKryptos> | IKryptos): void;
  env(keys: Array<string> | string): void;
  filter(query: AmphoraQuery): Promise<Array<IKryptos>>;
  filterSync(query: AmphoraQuery): Array<IKryptos>;
  find(query: AmphoraQuery): Promise<IKryptos>;
  findSync(query: AmphoraQuery): IKryptos;
  refresh(): Promise<void>;
  setup(): Promise<void>;

  canEncrypt(): boolean;
  canDecrypt(): boolean;

  canSign(): boolean;
  canVerify(): boolean;
}
