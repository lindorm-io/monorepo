import { SessionStatus } from "@lindorm-io/common-enums";
import { PublicClientInfo, PublicTenantInfo } from "../../oauth-service";
import { StandardRequestParamsWithId } from "../../standard";

export type SelectAccountDetails = {
  active: boolean;
  avatarUri: string | null;
  identityId: string;
  name: string | null;
  picture: string | null;
  selectId: string;
};

export type GetSelectAccountRequestParams = StandardRequestParamsWithId;

export type GetSelectAccountResponse = {
  sessions: Array<SelectAccountDetails>;
  status: SessionStatus;

  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};
