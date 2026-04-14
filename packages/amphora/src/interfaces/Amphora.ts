import { IKryptos } from "@lindorm/kryptos";
import { AmphoraConfig, AmphoraJwks, AmphoraPredicate } from "../types";

export interface IAmphora {
  config: Array<AmphoraConfig>;
  domain: string | null;
  jwks: AmphoraJwks;
  vault: Array<IKryptos>;

  add(kryptos: Array<IKryptos> | IKryptos): void;
  env(keys: Array<string> | string): void;
  filter(query: AmphoraPredicate): Promise<Array<IKryptos>>;
  filterSync(query: AmphoraPredicate): Array<IKryptos>;
  find(query: AmphoraPredicate): Promise<IKryptos>;
  findById(id: string): Promise<IKryptos>;
  findByIdSync(id: string): IKryptos;
  findSync(query: AmphoraPredicate): IKryptos;
  refresh(): Promise<void>;
  setup(): Promise<void>;

  canEncrypt(): boolean;
  canDecrypt(): boolean;

  canSign(): boolean;
  canVerify(): boolean;
}
