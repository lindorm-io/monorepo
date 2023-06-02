import { LindormIdentityClaims } from "../../../lindorm";

export type GetClaimsQuery = {
  session: string;
};

export type GetClaimsResponse = Partial<LindormIdentityClaims>;
