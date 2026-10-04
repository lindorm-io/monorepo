Feature: A verify-only profile's structural policy

  A profile written to accept tokens from an issuer this deployment does not
  control runs its structural policy on the verify path, because nothing on
  this side ever mints such a token. It admits the shape a third party emits,
  refuses the shapes its policy forbids, and refuses to issue a token of its own.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a third-party token whose issuer is not a URI is refused by the profile that demands one

    Requiring the issuer to be a URI is aegis policy, not a citation: `iss` is
    a StringOrURI (RFC 7519 §4.1.1), so the specification permits exactly what
    this refuses. The issuer identifier is what scopes key lookup — a bare
    identifier names no origin that can be resolved or compared, so accepting
    one lets the presenter name an issuer nobody can check. It sits looser than
    the issuer requirement in OpenID Connect Core 1.0 §2, because a third-party
    issuer need not be an OpenID provider.

    Background:
      Given the wire claims
        | iss | "acme-corp-not-a-uri"      |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the profile's issuer shape is enforced on arrival
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token under the "external_access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "verify" and locates the fault at "issuer": Claim "issuer" did not satisfy the profile rule predicate

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a token that expires before it was issued is refused as structurally incoherent

    `exp` is the instant on or after which a token must not be accepted and
    `iat` is when it was issued (RFC 7519 §4.1.4, RFC 7519 §4.1.6), so a token
    whose expiry precedes its issuance describes a lifetime that never existed.
    Each claim is individually plausible, so the incoherence has to be caught
    as a relationship between them — aegis policy at verify. The verifier's own
    upper bound on `iat` would refuse this token first, so it is lifted to let
    the structural rule be the thing that rejects.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T10:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier leaves the issue instant unchecked

    Scenario Outline: <wire>: an expiry that precedes the issue instant is refused as a relationship, not a bound
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token under the "external_access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "verify" and locates the fault at "expiresAt": expiresAt (exp) must be after issuedAt (iat)

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: the envelope claims a profile injects for the caller arrive on the wire under their registered names

    A profile injects the envelope claims a caller should not have to remember —
    who issued the token, when, and under what identifier. Each is a registered
    claim with a name of its own on each wire, so a value injected under a
    domain name and never translated arrives as a custom claim that looks right
    and answers nothing: no issuer check, replay cache or freshness bound reads
    it. Injection is also exactly what the profile declares: a profile that
    does not name `notBefore` must not stamp one. The token id is generated per
    token, so it is asserted by its type and not by its value.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"

    @RFC-7519
    Scenario: jose: the issuer is stamped under its registered JWT claim name (RFC-7519 §4.1.1)
      When I mint the content under the "access_token" profile on the jose wire
      Then the raw payload carries "iss" "https://test.lindorm.io/"

    @RFC-7519
    Scenario: jose: the issue instant is stamped under its registered JWT claim name (RFC-7519 §4.1.6)
      When I mint the content under the "access_token" profile on the jose wire
      Then the raw payload carries "iat" as the instant "2024-01-01T08:00:00.000Z"

    @RFC-7519
    Scenario: jose: the token id is stamped under its registered JWT claim name (RFC-7519 §4.1.7)
      When I mint the content under the "access_token" profile on the jose wire
      Then the raw payload carries a text string at "jti"

    @RFC-8392
    Scenario: cose: the issuer is stamped under its registered CWT claim key (RFC-8392 §3.1.1)
      When I mint the content under the "access_token" profile on the cose wire
      Then the raw payload carries claim key 1 "https://test.lindorm.io/"

    @RFC-8392
    Scenario: cose: the issue instant is stamped under its registered CWT claim key (RFC-8392 §3.1.6)
      When I mint the content under the "access_token" profile on the cose wire
      Then the raw payload carries claim key 6 as the instant "2024-01-01T08:00:00.000Z"

    @RFC-8392
    Scenario: cose: the token id is stamped as a byte string under its registered CWT claim key (RFC-8392 §3.1.7)
      When I mint the content under the "access_token" profile on the cose wire
      Then the raw payload carries a byte string at claim key 7

    Scenario Outline: <wire>: no lower bound is stamped, since the profile names none
      When I mint the content under the "access_token" profile on the <wire> wire
      Then the raw payload carries no <not before>

      Examples:
        | wire | not before  |
        | jose | "nbf"       |
        | cose | claim key 5 |

  Rule: a profile written for a third party's access tokens accepts several audiences and no client identifier

    The shape a third-party authorization server emits is not the shape this
    package issues, and a profile that exists to read one has to admit it. The
    multi-valued `aud` is the general case, and `client_id` is required only of
    tokens issued under the JWT access-token profile (RFC 9068 §2.2), which a
    foreign server is under no obligation to follow. The token is written by a
    third party on purpose: one built by the code under test would prove
    nothing about what a profile admits. The cose scenario carries no tag: the
    rule is the JWT specification's, and RFC 8392 §3.1.3 gives the CWT
    audience claim the same meaning and processing rules by reference to it.

    Background:
      Given the wire claims
        | iss   | "https://test.lindorm.io/"            |
        | sub   | "user-1"                              |
        | aud   | ["https://rs.lindorm.io/", "account"] |
        | jti   | "token-1"                             |
        | scope | "openid profile"                      |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier expects the issuer "https://test.lindorm.io/"

    @RFC-7519
    Scenario: jose: a token naming several audiences verifies, and the audience list is read back whole (RFC-7519 §4.1.3)
      When a third party signs the wire claims on the jose wire
      And I verify the token under the "external_access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "jwt"
      And the verified claims list the audience "https://rs.lindorm.io/", "account"

    Scenario: cose: a token naming several audiences verifies, and the audience list is read back whole
      When a third party signs the wire claims on the cose wire
      And I verify the token under the "external_access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "cwt"
      And the verified claims list the audience "https://rs.lindorm.io/", "account"

    Scenario Outline: <wire>: a token carrying no client identifier verifies under the third-party profile
      When a third party signs the wire claims on the <wire> wire
      And I verify the token under the "external_access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "<format>"
      And the verified claims include
        | subject | user-1 |

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    Scenario Outline: <wire>: the scope string the third party wrote is read back as the list it spells
      When a third party signs the wire claims on the <wire> wire
      And I verify the token under the "external_access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified claims list the scope "openid", "profile"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a token whose declared type is not a claims media type is refused before any profile is consulted

    The type header says which grammar a token's body follows, and checking
    that it names a claims media type is a wire guard: it stops a signed
    artifact of another kind being read as a claim set at all. The grammar
    admits the bare `JWT` (RFC 7519 §5.1) and the registered `+jwt` suffix
    (RFC 8417 §7.2, RFC 6838 §4.2.8), and the COSE parameter has the same role
    (RFC 9596 §2). A bare word that is neither is outside the grammar, so no
    profile is reached to admit it. Enforcing the grammar at the wire door is
    aegis policy, not a citation: `typ` is OPTIONAL and processing it belongs
    to the application, on either wire. The refusal is the wire reader's own,
    which is what shows the profile was never consulted.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier expects the issuer "https://test.lindorm.io/"

    Scenario Outline: <wire>: the wire reader refuses the type before any profile is reached
      When a third party signs the wire claims on the <wire> wire, typed "Bearer"
      And I verify the token under the "external_access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a <family> error
      And the refusal reports the type header it read "Bearer"

      Examples:
        | wire | family |
        | jose | JOSE   |
        | cose | COSE   |

  Rule: a profile that exists to check someone else's tokens refuses to issue one

    A profile written to read a third party's tokens carries their rules, not
    ours. Minting under it would emit a token signed with this deployment's key
    while wearing a policy chosen for somebody else's — a degraded token issued
    by accident and indistinguishable, on the wire, from a deliberate one. The
    envelope claims are supplied so the refusal cannot be mistaken for a mint
    that merely failed on the instant and identifier it would not generate.

    Background:
      Given the content to mint
        | issuer  | https://other-idp.lindorm.io/ |
        | subject | user-1                        |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the mint stamps the issue instant "2024-01-01T08:00:00.000Z"
      And the mint stamps the token id "token-1"

    Scenario Outline: <wire>: the mint is refused, naming the profile and the use it declares
      When I mint the content under the "external_access_token" profile on the <wire> wire
      Then minting is refused as a domain error "profile_not_mintable"
      And the refusal names the profile "external_access_token" and its declared use "verify"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a third-party token that satisfies the profile's structural policy verifies

    A structural policy has to refuse exactly the tokens that violate it and no
    others. A profile that rejected conformant tokens would be discovered only
    in production, and the usual remedy is to stop using the profile, which
    removes every rule it carried rather than the one that was wrong.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the profiled verify accepts the token and reports its format
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token under the "external_access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |
