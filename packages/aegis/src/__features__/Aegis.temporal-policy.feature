Feature: The temporal policy a verify applies

  Two questions are asked of a token's lifetime, and they must stay apart:
  whether the issuer stated one (presence, a domain policy) and whether it
  has run out (range, the wire kit's temporal predicate with the leeway the
  caller or the deployment allows). Each verify option waives exactly the
  check it names, a leeway is an inclusive width in seconds and not a switch,
  and a deployment-wide leeway reaches every call that states none. A range
  refusal is the wire kit's own, so it carries that wire's leaf class; a
  presence refusal is the domain's, under one wire-neutral code.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a token with no exp is refused by the profile floor even when it carries a custom expires_at claim

    Expiry is stated by the registered `exp` claim and by nothing else
    (RFC 7519 §4.1.4, RFC 8392 §3.1.4). A presence check that an unregistered
    claim could satisfy merely by resembling the registered one would let a
    producer hand out a token with no enforceable lifetime, which the verifier
    then honours indefinitely. The refusal is the presence gate's own code, so
    the look-alike is shown to have answered for nothing. No scenario carries
    a tag: the cited sections define the claim, the floor's demand for it on
    an access token is RFC 9068 §2.2's for a JWT, and that a look-alike cannot
    answer for the registered claim is aegis policy.

    Background:
      Given the wire claims
        | iss        | "https://test.lindorm.io/" |
        | sub        | "user-1"                   |
        | aud        | ["https://rs.lindorm.io/"] |
        | jti        | "token-1"                  |
        | client_id  | "client-1"                 |
        | expires_at | 978307200                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the claims token carries the type prefix "at"

    Scenario Outline: <wire>: the look-alike does not answer for the registered expiry claim
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "missing_claim_exp"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an access token carrying no expiry claim is refused

    A token that states no lifetime never expires, so a verifier has to refuse
    it outright rather than supply a default the issuer never authorised.
    `exp` is REQUIRED in a JWT access token (RFC 9068 §2.2), and the same
    claim rides the COSE wire (RFC 8392 §3.1.4). The cose scenario carries no
    tag: requiring the claim on that encoding is aegis policy, since
    RFC 8392 §3.1 mandates no claim — a lifetime a verifier cannot enforce is
    the same hazard on either wire.

    Background:
      Given the wire claims
        | iss       | "https://test.lindorm.io/" |
        | sub       | "user-1"                   |
        | aud       | ["https://rs.lindorm.io/"] |
        | jti       | "token-1"                  |
        | client_id | "client-1"                 |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the claims token carries the type prefix "at"

    @RFC-9068
    Scenario: jose: the expiry the access token profile requires is demanded on arrival (RFC-9068 §2.2)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "missing_claim_exp"

    Scenario: cose: the expiry the access token profile requires is demanded on arrival
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "missing_claim_exp"

  Rule: a token whose expiry check was waived is still refused when it names another audience

    Each verify option waives exactly the check it names. Waiving the expiry
    range has a narrow legitimate purpose — inspecting a previously-issued
    token whose signature, not its lifetime, is what matters — and a caller
    doing so is not asking to accept tokens minted for somebody else. An
    option whose effect spilled onto neighbouring checks would make every
    such inspection a hole, and the caller could not tell from the call site.
    The refusal is the audience floor's own code, so it is the neighbour that
    answered.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T06:00:00.000Z"
      And the wire claims expire at "2024-01-01T07:00:00.000Z"
      And the verifier leaves the expiry unchecked

    Scenario Outline: <wire>: the audience floor still refuses the token
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token under the "default" profile as the audience "https://elsewhere.lindorm.io/"
      Then verification is refused as a domain error "audience_mismatch"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a token carrying no expiry at all is still refused when only the expiry range check was waived

    Presence and range are two different questions about `exp`: whether the
    issuer stated a lifetime, and whether that lifetime has run out. A token
    that states none never expires, so the presence requirement is the only
    thing standing between a verifier and a credential that works forever —
    and a caller waiving the range check is asking to accept an expired
    token, which is a token that did state a lifetime. Folding the two into
    one flag would turn a narrow waiver into an unbounded one.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the verifier leaves the expiry unchecked

    Scenario Outline: <wire>: the presence gate refuses the token
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "missing_claim_exp"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a verify called with an empty option bag reaches the same verdict as one called with none

    An option bag states what the caller wants changed, so a bag stating
    nothing is the same request as no bag at all. Behaviour that turned on the
    presence of an empty bag could not be predicted from the signature and
    could only be discovered by trying both — and a defaulting path reached
    only when the caller passes nothing is a path most callers never take.
    The token carries no expiry, so the verdict compared is the presence
    refusal its bag-less twin reaches.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"

    Scenario Outline: <wire>: the empty bag is refused exactly as no bag is
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token with an empty option bag
      Then verification is refused as a domain error "missing_claim_exp"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a token older than the caller's freshness bound is refused even when the issued-at range check was waived

    The two options bound `iat` from opposite ends. `iat` is when the token
    was issued (RFC 7519 §4.1.6); the range check is the upper bound that
    refuses a token stamped in the future, a freshness bound the lower one
    that refuses a token stamped too long ago. A caller accepting a
    future-dated token — a clock it does not control — is not thereby
    accepting a stale one, so folding the two into a single condition would
    remove the bound the caller asked for in the same call. The bound lives in
    the wire kit's temporal predicate, so the refusal is that wire's leaf
    class under the kit's own code.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T07:50:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier leaves the issue instant unchecked
      And the verifier allows an age of at most 300 seconds

    Scenario Outline: <wire>: the freshness bound refuses the token as the wire kit's own error
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a <family> error "<code>"

      Examples:
        | wire | family | code               |
        | jose | JWT    | jwt_claims_invalid |
        | cose | CWT    | cwt_claims_invalid |

  Rule: a profiled verify accepts a token that expired exactly as long ago as the leeway the caller allows

    A small leeway for clock skew is allowed when checking `exp`
    (RFC 7519 §4.1.4). The profiled call and the profile-less one are separate
    forwards of the same bag, so a leeway honoured by one and dropped by the
    other would make the identical token verify or fail depending only on
    whether the caller named a profile. The token sits on the boundary rather
    than comfortably inside it, so the allowance is stated as an inclusive
    width. The cose scenario carries no tag: the leeway is the JWT document's,
    and RFC 8392 §3.1.4 gives the CWT expiry claim the same processing rules
    by reference to it.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T07:00:00.000Z"
      And the wire claims expire at "2024-01-01T07:59:55.000Z"
      And the verifier allows a clock tolerance of 5 seconds

    @RFC-7519
    Scenario: jose: the token on the leeway's boundary verifies under the profile (RFC-7519 §4.1.4)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "jwt"

    Scenario: cose: the token on the leeway's boundary verifies under the profile
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "cwt"

  Rule: a verify refuses a token that expired one second beyond the leeway the caller allows

    The leeway allowed for clock skew is a bounded allowance and not a
    suspension of the expiry check (RFC 7519 §4.1.4). The magnitude is the
    rule: a leeway applied in a unit other than the one the caller stated, or
    scaled on the way in, still accepts every token an honest one would and is
    invisible to any test that only widens the window. This rule and its
    accepting twin sit one second apart around the same stated tolerance, so
    the window has exactly the width the caller asked for. The refusal is the
    wire kit's temporal predicate, so it carries that wire's leaf class. The
    cose scenario carries no tag: the leeway is the JWT document's, and
    RFC 8392 §3.1.4 gives the CWT expiry claim the same processing rules by
    reference to it.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T07:00:00.000Z"
      And the wire claims expire at "2024-01-01T07:59:54.000Z"
      And the verifier allows a clock tolerance of 5 seconds

    @RFC-7519
    Scenario: jose: the token one second past the leeway is refused as the wire kit's own error (RFC-7519 §4.1.4)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a JWT error "jwt_claims_invalid"

    Scenario: cose: the token one second past the leeway is refused as the wire kit's own error
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a CWT error "cwt_claims_invalid"

  Rule: a deployment configured with a clock tolerance applies it to a verify that states no tolerance of its own

    A deployment states its skew allowance once, at construction, because it
    is a property of the estate's clocks and not of any one call. Every call
    then inherits it, and a per-call value overrides rather than replaces the
    mechanism. A default that is accepted and never consulted is the worst of
    both: the operator sees the setting in the configuration, every call
    behaves as though it were zero, and the resulting refusals name the
    token's expiry rather than the setting nobody is reading.

    Background:
      Given the deployment allows a clock tolerance of 5 seconds
      And the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T07:00:00.000Z"
      And the wire claims expire at "2024-01-01T07:59:55.000Z"

    Scenario Outline: <wire>: the token on the deployment's boundary verifies
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: a deployment configured with a clock tolerance refuses a token that expired one second beyond it

    A deployment-wide allowance is a width, not a switch, and the width is the
    whole safety property: an operator who configures a minute of skew has
    accepted one minute of replay after expiry and no more. A setting read in
    the wrong unit, or scaled, keeps accepting everything the operator
    intended and silently accepts far more besides, and no accepting scenario
    can tell the difference. Paired with its accepting twin one second away,
    this fixes the deployment default's boundary exactly where the operator
    put it.

    Background:
      Given the deployment allows a clock tolerance of 5 seconds
      And the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T07:00:00.000Z"
      And the wire claims expire at "2024-01-01T07:59:54.000Z"

    Scenario Outline: <wire>: the token one second past the deployment's boundary is refused as the wire kit's own error
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a <family> error "<code>"

      Examples:
        | wire | family | code               |
        | jose | JWT    | jwt_claims_invalid |
        | cose | CWT    | cwt_claims_invalid |
