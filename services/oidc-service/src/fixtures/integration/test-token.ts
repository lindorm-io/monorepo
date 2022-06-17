import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";

export const getTestGoogleIdToken = (options: Partial<JwtSignOptions<any, any>> = {}): string => {
  const { token } = createTestJwt({
    issuer: "https://jwt.google.com",
  }).sign({
    audiences: ["google_client_id"],
    claims: {
      given_name: "given",
    },
    expiry: "10 seconds",
    nonce: options.nonce,
    subject: "aee67d8d-62a1-4361-914a-15527342ac4e",
    subjectHint: "identity",
    type: "access_token",
  });
  return token;
};
