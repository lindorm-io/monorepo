export type FindIdentityRequestQuery = {
  email?: string;
  external?: string;
  nin?: string;
  phone?: string;
  provider?: string;
  ssn?: string;
  username?: string;
};

export type FindIdentityResponse = { identityId: string | null };
