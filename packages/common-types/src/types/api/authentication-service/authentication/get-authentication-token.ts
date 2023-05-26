import { AuthenticationMethod } from "../../../../enums";
import { LevelOfAssurance } from "../../../auth";

export type GetAuthenticationTokenQuery = {
  session: string;
};

export type GetAuthenticationTokenResponse = {
  identityId: string;
  latestAuthentication: string;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
  nonce: string;
};
