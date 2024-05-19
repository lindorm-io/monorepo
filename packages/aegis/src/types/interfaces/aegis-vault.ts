import { IKryptos } from "@lindorm/kryptos";
import { AegisVaultQuery, VaultConfig } from "../aegis-vault";

export interface IAegisVault {
  config: Array<VaultConfig>;
  vault: Array<IKryptos>;

  add(kryptos: Array<IKryptos> | IKryptos): void;
  filter(query: AegisVaultQuery): Promise<Array<IKryptos>>;
  find(query: AegisVaultQuery): Promise<IKryptos>;
  refresh(): Promise<void>;
  setup(): Promise<void>;
}
