Feature: Logout tokens

  A logout token tells a relying party what to terminate, and one naming
  neither a subject nor a session names nothing. The requirement is on the
  token a verifier receives, so it is enforced at verify: a rule enforced
  only at mint constrains this issuer's own output and says nothing about
  the token that actually arrived. The floor refuses exactly the tokens that
  identify nothing and no others. The document defines a JWT; a CWT logout
  token is aegis carrying the same profile on its second wire, so the cose
  scenarios carry no tag.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a logout token naming neither a subject nor a session is refused — it identifies nothing to log out

    A relying party handed a logout token naming neither a `sub` nor a `sid`
    has nothing to terminate (OpenID Connect Back-Channel Logout 1.0 §2.4).
    Everything else the profile requires is present, so the refusal is the
    floor's own code and names the alternation the token failed and nothing
    else.

    Background:
      Given the wire claims
        | iss    | "https://test.lindorm.io/"                                 |
        | aud    | ["client-1"]                                               |
        | jti    | "token-1"                                                  |
        | events | { "http://schemas.openid.net/event/backchannel-logout": {} } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T08:02:00.000Z"
      And the claims token carries the type prefix "logout"

    @openid-connect-backchannel-1_0
    Scenario: jose: the token is refused by the floor, naming the alternation it fails (OpenID Connect Back-Channel Logout 1.0 §2.4)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token under the "logout_token" profile as the audience "client-1"
      Then verification is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "verify" and locates the fault at "subject|sessionId": At least one of [subject, sessionId] is required

    Scenario: cose: the token is refused by the floor, naming the alternation it fails
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token under the "logout_token" profile as the audience "client-1"
      Then verification is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "verify" and locates the fault at "subject|sessionId": At least one of [subject, sessionId] is required

  Rule: a logout token naming a subject verifies

    A `sub` alone satisfies the identification requirement
    (OpenID Connect Back-Channel Logout 1.0 §2.4). A floor that refused a
    logout token naming one would break every conformant back-channel
    logout, so the identification rule must reject exactly the tokens that
    identify nothing and no others.

    Background:
      Given the wire claims
        | iss    | "https://test.lindorm.io/"                                 |
        | aud    | ["client-1"]                                               |
        | sub    | "user-1"                                                   |
        | jti    | "token-1"                                                  |
        | events | { "http://schemas.openid.net/event/backchannel-logout": {} } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T08:02:00.000Z"
      And the claims token carries the type prefix "logout"

    @openid-connect-backchannel-1_0
    Scenario: jose: the token naming a subject verifies under the logout profile (OpenID Connect Back-Channel Logout 1.0 §2.4)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token under the "logout_token" profile as the audience "client-1"
      Then the verified token is a "jwt"

    Scenario: cose: the token naming a subject verifies under the logout profile
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token under the "logout_token" profile as the audience "client-1"
      Then the verified token is a "cwt"
