import { AuthenticationStrategyConfirmKey, AuthenticationStrategyConfirmMode } from "../../enums";

export type AuthStrategyConfig = {
  id: string;
  confirmKey: AuthenticationStrategyConfirmKey;
  confirmLength: number | null;
  confirmMode: AuthenticationStrategyConfirmMode;
  displayCode: string | null;
  expires: string;
  pollingRequired: boolean;
  qrCode: string | null;
  strategySessionToken: string | null;
  visualHint: string | null;
};
