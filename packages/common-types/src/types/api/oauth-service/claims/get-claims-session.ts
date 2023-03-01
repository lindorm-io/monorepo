import { AdjustedAccessLevel, LevelOfAssurance } from "../../../auth";
import { AuthenticationMethod, LindormScope, OpenIdScope } from "../../../../enums";
import { StandardRequestParamsWithId } from "../../standard";
import { PublicClientInfo } from "../public-client-info";

export type GetClaimsSessionRequestParams = StandardRequestParamsWithId;

export type GetClaimsSessionResponse = {
  adjustedAccessLevel: AdjustedAccessLevel;
  audiences: Array<string>;
  expiresAt: string;
  expiresIn: number;
  identityId: string;
  latestAuthentication: string;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  scopes: Array<OpenIdScope | LindormScope>;

  client: PublicClientInfo;
};
