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

  Rule: a logout token authenticated with a shared secret verifies

    A logout token's algorithm is validated the way an ID Token's is, and
    its selection is governed by the same discovery and registration
    parameters (OpenID Connect Back-Channel Logout 1.0 §2.6). An ID Token
    may carry a MAC algorithm keyed with the client secret
    (OpenID Connect Core 1.0 §10.1), so a relying party that registered one
    receives its logout tokens under it. A floor demanding a signature here
    would refuse every such logout and leave the sessions it names running.
    The profile declares no algorithm class, which is what separates it
    from a profile that refuses the same token. The token is a third
    party's, authenticated with the secret the vault holds.

    Background:
      Given the vault also holds an HS256 signing key
      And the wire claims
        | iss    | "https://test.lindorm.io/"                                 |
        | aud    | ["client-1"]                                               |
        | sub    | "user-1"                                                   |
        | jti    | "token-1"                                                  |
        | events | { "http://schemas.openid.net/event/backchannel-logout": {} } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T08:02:00.000Z"

    @openid-connect-backchannel-1_0
    @openid-connect-core-1_0
    Scenario: jose: the MAC-authenticated logout token verifies as a JWT (OpenID Connect Back-Channel Logout 1.0 §2.6) (OpenID Connect Core 1.0 §10.1)
      When a third party authenticates the wire claims with the shared secret on the jose wire, typed "application/logout+jwt"
      And I verify the token under the "logout_token" profile as the audience "client-1"
      Then the verified token is a "jwt"

    Scenario: cose: the MAC-authenticated logout token verifies, and reports the MAC-authenticated format
      When a third party authenticates the wire claims with the shared secret on the cose wire, typed "application/logout+cwt"
      And I verify the token under the "logout_token" profile as the audience "client-1"
      Then the verified token is a "cwm"

  Rule: a logout token is minted with a shared secret

    The issuer selects a logout token's algorithm as it selects an ID
    Token's (OpenID Connect Back-Channel Logout 1.0 §2.6), and it must
    select one the recipient supports — a MAC algorithm keyed with the
    client secret among them (OpenID Connect Core 1.0 §10.1). A mint that
    refused a shared secret here could not log out a relying party that
    registered a MAC algorithm. The secret is handed to the mint outright,
    as a client secret is, and the algorithm is read off the bytes. On the
    COSE wire a shared secret produces a COSE_Mac0, so that scenario asks
    for the MAC-authenticated form, whose HMAC 256/256 algorithm is the
    integer 5 (RFC 9053 §3.1).

    Background:
      Given the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And the events claim is the object
        """json
        { "http://schemas.openid.net/event/backchannel-logout": {} }
        """
      And the mint is handed the HS256 signing key outright

    @openid-connect-backchannel-1_0
    @openid-connect-core-1_0
    Scenario: jose: the logout token is minted under the shared secret's MAC algorithm (OpenID Connect Back-Channel Logout 1.0 §2.6) (OpenID Connect Core 1.0 §10.1)
      When I mint the content under the "logout_token" profile on the jose wire
      Then the raw protected header carries "alg" "HS256"

    Scenario: cose: the logout token is minted as a COSE_Mac0 under the shared secret's MAC algorithm
      When I mint the content under the "logout_token" profile as a MAC-authenticated claims token
      Then the raw protected header carries label 1 as the integer 5
