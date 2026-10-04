Feature: The audience floor

  A profiled verify names the audience the verifier is, and the floor refuses a
  token whose wire audience does not name it. Only the registered claim states
  who the issuer meant a token for; nothing a presenter writes beside it can
  answer on that claim's behalf.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a token whose wire audience names someone else is refused even when it also carries a custom audience claim

    The audience floor is what stops a token minted for one resource being
    replayed at another. Only the registered wire claim states who the issuer
    meant it for; an unregistered custom claim that spells the same word
    differently carries no such statement, and if it could answer for the
    registered claim the presenter, not the issuer, would decide the audience.

    Background:
      Given the wire claims
        | iss      | "https://test.lindorm.io/" |
        | sub      | "user-1"                   |
        | aud      | ["someone-else"]           |
        | audience | ["https://rs.lindorm.io/"] |
        | jti      | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-7519
    Scenario: jose: the look-alike does not answer for the registered audience claim (RFC-7519 §4.1.3)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "audience_mismatch"
      And the refusal reports the audience it read as the list "someone-else"

    @RFC-8392
    Scenario: cose: the look-alike does not answer for the registered audience claim (RFC-8392 §3.1.3)
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "audience_mismatch"
      And the refusal reports the audience it read as the list "someone-else"

  Rule: a token that states no audience at all is refused, even when it carries a custom audience claim

    `aud` is the claim by which an issuer names who a token is for, on either
    encoding (RFC 7519 §4.1.3, RFC 8392 §3.1.3). A token that omits it names
    nobody, so a verifier identifying itself cannot be in it. Refusing on
    absence is aegis policy at verify, not a citation: the claim is OPTIONAL and
    its mandated rejection is scoped to a token that carries it, so the
    specification permits exactly what this floor refuses. The floor exists
    because a rule comparing the registered claim only when present lets a
    presenter supply a look-alike of its own and be believed.

    Background:
      Given the wire claims
        | iss      | "https://test.lindorm.io/" |
        | sub      | "user-1"                   |
        | audience | ["https://rs.lindorm.io/"] |
        | jti      | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: a token naming nobody is refused, whatever the look-alike says
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "audience_mismatch"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a token whose wire audience names someone else is refused

    A token whose `aud` names someone else was minted for another resource, and
    accepting it is the replay the claim exists to stop. The refusal reports the
    audience it read, so it is attributable to the audience check itself and
    not to whatever unrelated rule fired first.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["someone-else"]           |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-7519
    Scenario: jose: a verifier not named in the audience refuses the token (RFC-7519 §4.1.3)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "audience_mismatch"
      And the refusal reports the audience it read as the list "someone-else"

    @RFC-8392
    Scenario: cose: a verifier not named in the audience refuses the token (RFC-8392 §3.1.3)
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "audience_mismatch"
      And the refusal reports the audience it read as the list "someone-else"
