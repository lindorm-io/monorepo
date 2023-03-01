import { LindormClaims } from "../../../lindorm";

export type GetClaimsQuery = {
  session: string;
};

export type GetClaimsResponse = Partial<LindormClaims>;
