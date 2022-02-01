import { ConsentSession, ConsentSessionOptions } from "../../entity";
import { Scope } from "../../common";

export const getTestConsentSession = (
  options: Partial<ConsentSessionOptions> = {},
): ConsentSession =>
  new ConsentSession({
    audiences: ["411ab157-e9df-4be8-a607-c5452a5d6d55", "70e9d574-be33-47a2-bcfb-e596c2170bb1"],
    clientId: "5d2bb923-4db8-48cd-8af8-97316c79bd67",
    identityId: "68a23a82-c977-43f4-91b2-11a17f5189ed",
    scopes: [Scope.OPENID, Scope.EMAIL, Scope.PROFILE],
    sessions: ["90ea1c84-5e5e-4d66-ae30-fbf0011f56f6", "f81ec7be-f877-48d4-9cf6-fa2db481f220"],
    ...options,
  });
