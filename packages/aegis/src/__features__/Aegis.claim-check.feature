Feature: Checking claims without a signature

  Verify's claim checking without the signature: the same matcher argument and
  the same temporal window, run over a flat claim set that arrived some other
  way — an introspection response, a cached credential, a claim set verified
  upstream. Every rule here is one a caller would otherwise hand-roll, and a
  hand-rolled version disagrees with the verified arm at the boundary. The
  check is offered at two doors. A deployment's runs the window in the
  deployment's clock tolerance, the one its verify runs in, so the two arms
  agree at the boundary without the caller restating anything. The one
  outside any deployment allows no clock tolerance unless its caller states
  one, there being no deployment to read it from. Each door has two forms
  that must agree — the boolean one answers, the throwing one refuses — so
  every verdict is read off both. No scenario carries a tag: the door is
  handed a claim set in the domain vocabulary, and the cited documents state
  processing rules for a token, not for a claim set outside one. The
  descriptions cite the obligations the defaults carry over.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a caller asserting one value of a list-valued claim is answered by a claim containing it

    Several registered claims are lists: an array of strings is the general
    form of `aud` (RFC 7519 §4.1.3), and `scope` is a space-separated list of
    scopes (RFC 8693 §4.2) — the authorisation claims beside it follow the same
    shape. A caller naming one value of such a claim is asking whether the
    list contains it, which is the only question a single identity can pose:
    it never expects the list to consist of that value alone. A matcher
    compiled to an equality test answers false for every such claim, so the
    whole family becomes unassertable at once. The seven are stated as a set,
    because the containment rule is one rule over all of them.

    Background:
      Given the claims to check
        | audience     | ["a-value"] |
        | scope        | ["a-value"] |
        | authMethods  | ["a-value"] |
        | roles        | ["a-value"] |
        | permissions  | ["a-value"] |
        | groups       | ["a-value"] |
        | entitlements | ["a-value"] |
      And the verifier asserts
        """json
        {
          "audience": "a-value",
          "scope": "a-value",
          "authMethods": "a-value",
          "roles": "a-value",
          "permissions": "a-value",
          "groups": "a-value",
          "entitlements": "a-value"
        }
        """

    Scenario: one value of each list claim is answered by the list containing it
      When I check the claims without a signature
      Then the claims are accepted

  Rule: a caller asserting a value a list-valued claim does not carry is refused

    Containment that never fails is not containment. These are the claims
    authorisation decisions are made on — scopes, roles, permissions,
    entitlements — so a matcher over them that accepts every list grants
    every request it was written to gate, and it does so at the one call site
    the deployment believes is doing the gating. The refusal names every list
    that failed, so no claim of the family can pass on another's account.

    Background:
      Given the claims to check
        | audience     | ["a-value"] |
        | scope        | ["a-value"] |
        | authMethods  | ["a-value"] |
        | roles        | ["a-value"] |
        | permissions  | ["a-value"] |
        | groups       | ["a-value"] |
        | entitlements | ["a-value"] |
      And the verifier asserts
        """json
        {
          "audience": "not-carried",
          "scope": "not-carried",
          "authMethods": "not-carried",
          "roles": "not-carried",
          "permissions": "not-carried",
          "groups": "not-carried",
          "entitlements": "not-carried"
        }
        """

    Scenario: a value no list carries is refused under every list claim
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "audience", "scope", "authMethods", "roles", "permissions", "groups", "entitlements"

  Rule: a caller asserting several values of a list-valued claim is answered when the claim carries them all

    A caller naming several values is stating a conjunction — this operation
    needs both scopes — because the alternative reading is already available
    as an explicit any-of condition. Choosing conjunction as the bare-array
    meaning is what makes the common case safe by default: an implicit any-of
    would grant an operation to a token carrying only the weakest of the
    scopes the caller listed, and the call site would look identical.

    Background:
      Given the claims to check
        | scope | ["openid", "profile"] |
      And the verifier asserts
        """json
        { "scope": ["openid", "profile"] }
        """

    Scenario: the list carrying every asserted value is accepted
      When I check the claims without a signature
      Then the claims are accepted

  Rule: a caller asserting several values is refused by a claim carrying only some of them

    The refusing half is what makes the conjunction real. A partial match
    accepted here is the any-of reading arriving by accident, and it arrives
    silently: the accepting case passes either way, so nothing but this
    distinguishes the two meanings — and the difference between them is
    whether a token holding one scope may perform an operation that requires
    two.

    Background:
      Given the claims to check
        | scope | ["openid"] |
      And the verifier asserts
        """json
        { "scope": ["openid", "profile"] }
        """

    Scenario: the list carrying only some of the asserted values is refused under the claim
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "scope"

  Rule: a caller asserting several values of a list-valued claim is answered by a claim carrying them and more

    Asserting a list asks the claim to contain every listed value. A claim
    carrying more still answers, and that tells containment from equality:
    the pair above passes under a whole-list equality test too, because its
    accepted list matches the asserted one exactly and its refused list is a
    strict subset. The difference is whether a token holding an extra scope
    is refused for it. This is aegis policy, not a specification requirement.

    Background:
      Given the claims to check
        | scope | ["openid", "profile", "email"] |
      And the verifier asserts
        """json
        { "scope": ["openid", "profile"] }
        """

    Scenario: the list carrying every asserted value and more is accepted
      When I check the claims without a signature
      Then the claims are accepted

  Rule: a caller bounding a numeric claim with a comparison is refused by a value below the bound

    A bare value is sugar for a condition, so the condition itself must pass
    through untouched — otherwise the sugar is the whole surface and anything
    it cannot express is unreachable. The refusing direction is the one to
    pin, because an unevaluated condition object compares as a value against
    the claim, and no claim equals an object: the failure would then be that
    everything is refused, which is loud, or that the branch is skipped
    entirely, which is silent and accepts everything.

    Background:
      Given the claims to check
        | levelOfAssurance | 1 |
      And the verifier asserts
        """json
        { "levelOfAssurance": { "$gte": 2 } }
        """

    Scenario: the comparison is evaluated and the value below the bound is refused under the claim
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "levelOfAssurance"

  Rule: an assertion that fails on several claims names all of them

    The caller of a claim check is deciding what to tell its own caller and
    what to log, and both answers depend on which requirements were not met.
    Reporting the first failure alone turns one round trip into as many as
    there are failing claims, and in an authorisation path those round trips
    are a user retrying a request that was never going to succeed.

    Background:
      Given the claims to check
        | audience | ["https://other.lindorm.io/"] |
        | subject  | "user-1"                      |
      And the verifier asserts
        """json
        { "audience": "https://rs.lindorm.io/", "subject": "someone-else" }
        """

    Scenario: both failing claims are named in the one refusal
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "audience", "subject"

  Rule: a caller stating a conjunction to the claim check is answered by a claim set satisfying every member

    The claim check takes the same matcher argument as verify, and a
    matcher argument is a condition that composes. A surface that read a
    conjunction as a claim name would find no such claim in any set and
    refuse every caller who composed one, so the accepting direction shows
    the composition was compiled rather than named.

    Background:
      Given the claims to check
        | subject  | "user-1"   |
        | clientId | "client-1" |
      And the verifier asserts
        """json
        { "$and": [{ "subject": "user-1" }, { "clientId": "client-1" }] }
        """

    Scenario: the claim set satisfying every member is accepted
      When I check the claims without a signature
      Then the claims are accepted

  Rule: a caller stating a conjunction to the claim check is refused by a claim set failing one member, under the conjunction's own key

    The refusal names the top-level entries of the matcher argument that did
    not hold, and a root operator is a top-level entry of its own: the caller
    wrote `$and`, and `$and` is what did not hold. A conjunction fails as a
    whole, and its failing member is not always a single claim, so the entry
    the caller wrote is the one reported.

    Background:
      Given the claims to check
        | subject  | "user-1"   |
        | clientId | "client-1" |
      And the verifier asserts
        """json
        { "$and": [{ "subject": "user-1" }, { "clientId": "someone-else" }] }
        """

    Scenario: the claim set failing one member is refused under the conjunction's own key
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "$and"

  Rule: a caller stating a disjunction to the claim check is answered by a claim set satisfying only its second member

    A disjunction holds when any member does, and the member that holds must
    not have to be the first. A surface evaluating only the first member
    would refuse every claim set the caller admitted through the second, and
    would look correct on every check that names the accepted identity first.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the verifier asserts
        """json
        { "$or": [{ "subject": "someone-else" }, { "subject": "user-1" }] }
        """

    Scenario: the claim set satisfying the second member alone is accepted
      When I check the claims without a signature
      Then the claims are accepted

  Rule: a caller negating a claim matcher at the claim check is refused by a claim set matching it, under the negation's own key

    A negation fails exactly when its payload holds, and the refusal names
    the entry that failed: `$not`. The claim inside the negation matched, so
    naming it as failing would tell the caller the opposite of what happened.
    The diagnosis evaluates each top-level entry against the whole claim set
    because a negation has no claim of its own to read.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the verifier asserts
        """json
        { "$not": { "subject": "user-1" } }
        """

    Scenario: the claim set matching the negated matcher is refused under the negation's own key
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "$not"

  Rule: a raw hash source presented to the claim check matches nothing

    `at_hash` is derived with the hash function the token's signing `alg`
    selects (OpenID Connect Core 1.0 §3.1.3.6), and `alg` is a header
    parameter. This surface is handed a flat claim set with no header, so it
    cannot know which function to apply — a surface that guessed would produce
    a digest that matches for one algorithm and silently fails for every
    other, which is indistinguishable from a substituted access token. The
    division is structural, not an omission: the key-holding verify derives,
    and this door matches the digest mint already wrote. A raw source key is
    therefore an ordinary claim name here, and the claim set carries no such
    claim.

    Background:
      Given the claims to check
        | accessTokenHash | "a-digest" |
      And the verifier asserts
        """json
        { "accessToken": "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c" }
        """

    Scenario: the raw source is matched as a claim name the set does not carry, and refused under it
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "accessToken"

  Rule: a caller holding a verified security event's claims asserts its transaction identifier and its events by name

    A security event token may carry a transaction identifier that correlates
    the related tokens of one transaction, beside its events map keyed by
    event URI (RFC 8417 §2.2). The token read returns both under their domain
    names, beside every other registered claim, so a caller checking that
    claim set names them the way it names any other claim. A vocabulary
    narrower than the read leaves exactly these two unassertable, and the
    caller falls back to a hand-rolled comparison that disagrees with the
    matcher at the boundary. The claims checked are the ones the verify
    returned rather than the content that was minted, so the answer is about
    what the token carried, not about what the caller wrote.

    Background:
      Given the content to mint
        | transactionId | txn_abc |
      And an audience list whose only member is "https://receiver.lindorm.io/"
      And the subject identifier
        | format  | iss_sub                  |
        | issuer  | https://test.lindorm.io/ |
        | subject | user-1                   |
      And an events map whose only event is "urn:lindorm:event:test"

    Scenario Outline: <wire>: the transaction identifier the verified claims carry is accepted under its name
      When I mint the content under the "security_event" profile on the <wire> wire
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      And I check the verified claims without a signature, asserting
        """json
        { "transactionId": "txn_abc" }
        """
      Then the claims are accepted

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: a transaction identifier the verified claims do not carry is refused under its name
      When I mint the content under the "security_event" profile on the <wire> wire
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      And I check the verified claims without a signature, asserting
        """json
        { "transactionId": "txn_other" }
        """
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "transactionId"

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: the event the verified claims carry is accepted under its URI
      When I mint the content under the "security_event" profile on the <wire> wire
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      And I check the verified claims without a signature, asserting
        """json
        { "events": { "urn:lindorm:event:test": { "$exists": true } } }
        """
      Then the claims are accepted

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: an event the verified claims do not carry is refused under the events claim
      When I mint the content under the "security_event" profile on the <wire> wire
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      And I check the verified claims without a signature, asserting
        """json
        { "events": { "urn:lindorm:event:other": { "$exists": true } } }
        """
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "events"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an expired claim set is refused even when the caller asserts nothing about time

    `exp` is the instant on or after which a token must not be accepted for
    processing (RFC 7519 §4.1.4), and that obligation belongs to whoever is
    processing the claims — it does not lapse because the signature was
    checked upstream. Applying the bound by default is what retires the
    hand-rolled `exp > now` a caller would otherwise write, and a hand-rolled
    one carries no clock tolerance, so a claim set inside the verified arm's
    skew window passes there and fails here. The refusal names the expiry
    claim, so it is attributable to the window rather than to the matcher the
    caller did state.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T07:00:00.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """

    Scenario: the expired claim set is refused under the expiry claim the caller never asserted
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "expiresAt"

  Rule: a claim set is refused at the instant it expires

    `exp` is the instant on or after which a token must not be accepted for
    processing (RFC 7519 §4.1.4), so the instant itself already lies outside
    the window. With no leeway the expiry and the judging instant are the
    same, the one instant where the window could disagree with the
    hand-rolled `exp > now` it retires.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T08:00:00.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """
      And the verifier allows a clock tolerance of 0 seconds

    Scenario: the claim set whose expiry is the judging instant is refused under the expiry claim
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "expiresAt"

  Rule: a claim set carrying no expiry passes the temporal window

    `exp` is OPTIONAL (RFC 7519 §4.1.4), and a whole class of conformant
    tokens sits on the other side of that: it is NOT RECOMMENDED in a security
    event token (RFC 8417 §2.2). A range bound that treated an absent claim as
    a failed one would refuse every such claim set — and would report the
    refusal as an expiry, which points whoever reads it at a clock rather than
    at a claim that was never there. Whether the claim must be present is a
    different question, answered by a different policy.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """

    Scenario: the claim set with no expiry is accepted
      When I check the claims without a signature
      Then the claims are accepted

  Rule: an expired claim set is accepted when the caller waives the expiry range

    The waiver has the same narrow purpose here as on the verified arm —
    inspecting a claim set whose lifetime is not what is being trusted — and
    the two surfaces must offer it identically, or a caller migrating a check
    from one to the other silently changes the answer. An option accepted and
    dropped is the worst shape for it: nothing raises, and the caller
    concludes the claim set was live.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T07:00:00.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """
      And the verifier leaves the expiry unchecked

    Scenario: the expired claim set is accepted under the waiver
      When I check the claims without a signature
      Then the claims are accepted

  Rule: a claim set expired inside the leeway the caller allows is accepted

    A small leeway for clock skew is provided for (RFC 7519 §4.1.4). The
    leeway is the deployment's to choose and it is the reason this surface
    applies the window at all rather than leaving it to the caller: a
    hand-rolled comparison has no leeway, so the two arms disagree for exactly
    the claim sets skew produces — the ones that arrive at the boundary of the
    window, intermittently, in production.

    Background:
      Given the clock reads "2024-01-01T09:00:10.000Z"
      And the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """
      And the verifier allows a clock tolerance of 60 seconds

    Scenario: the claim set ten seconds past its expiry is accepted inside a sixty-second leeway
      When I check the claims without a signature
      Then the claims are accepted

  Rule: a claim set expired inside the deployment's clock tolerance is accepted

    The leeway is the deployment's to choose, and a deployment chooses it
    once: the window the claim check runs in is the one its verify runs in, so
    a claim set inside the verified arm's skew window passes the check without
    the caller restating the tolerance at every call site. A check that did
    not read the deployment's tolerance would refuse, at the boundary, exactly
    the claim sets verify accepts — intermittently, in production.

    Background:
      Given the deployment allows a clock tolerance of 30 seconds
      And the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T07:59:50.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """

    Scenario: the claim set ten seconds past its expiry is accepted inside the deployment's thirty-second tolerance
      When I check the claims without a signature
      Then the claims are accepted

  Rule: a claim set expired ten seconds ago is refused by a deployment allowing no clock tolerance

    A deployment stating no tolerance gets none: `exp` is the instant on or
    after which a token must not be accepted for processing (RFC 7519 §4.1.4),
    and the deployment's window is the only leeway the check applies on its
    behalf. The refusal names the expiry claim, so it is attributable to the
    window rather than to the matcher the caller did state.

    Background:
      Given the deployment allows a clock tolerance of 0 seconds
      And the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T07:59:50.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """

    Scenario: the claim set ten seconds past its expiry is refused by a deployment allowing no tolerance
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "expiresAt"

  Rule: a caller's own clock tolerance replaces the deployment's for that check

    The deployment's tolerance is the default, not a floor. A caller stating a
    tolerance at the call is asking a narrower or wider question about this
    claim set, and it gets the one it asked: a check taking the wider of the
    two would leave the caller no way to tighten the window for one decision,
    and a check taking the deployment's regardless would make the option a
    knob that turns nothing.

    Background:
      Given the deployment allows a clock tolerance of 30 seconds
      And the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T07:59:50.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """
      And the verifier allows a clock tolerance of 0 seconds

    Scenario: the claim set ten seconds past its expiry is refused under the caller's zero tolerance at a deployment allowing thirty seconds
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "expiresAt"

  Rule: a caller leaving its clock tolerance undefined is answered in the deployment's

    An option bag a caller builds from its own configuration often carries
    the key with no value, and that is a tolerance not stated, not a
    tolerance of nothing. The deployment's window answers it exactly as it
    answers a bag without the key: an undefined knob is the absence of a
    statement, and reading it as a statement of zero would refuse at the
    boundary the claim sets the deployment configured itself to accept.

    Background:
      Given the deployment allows a clock tolerance of 30 seconds
      And the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T07:59:50.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """
      And the verifier's clock tolerance is left undefined

    Scenario: the claim set ten seconds past its expiry is accepted inside the deployment's tolerance when the caller's is left undefined
      When I check the claims without a signature
      Then the claims are accepted

  Rule: a claim check outside any deployment allows no clock tolerance unless its caller states one

    The check is offered outside any deployment too, for a caller holding a
    claim set and no vault — a test, a tool reading a cached credential.
    There is no deployment to read a tolerance from, so none is applied: the
    window is the strict one `exp` states (RFC 7519 §4.1.4), and a caller
    wanting leeway states it. The deployment this scenario builds, and the
    tolerance it allows, stand beside the check and never reach it.

    Background:
      Given the deployment allows a clock tolerance of 30 seconds
      And the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T07:59:50.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """

    Scenario: the claim set ten seconds past its expiry is refused outside any deployment
      When I check the claims without a signature or a deployment
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "expiresAt"

  Rule: a claim check outside any deployment widens by the clock tolerance its caller states

    Outside a deployment the caller is the only party that can state a
    tolerance, so the one it states is the one applied — the same knob, with
    the same meaning, as at a deployment's door. A check ignoring it would
    leave a caller outside any deployment no leeway at all, and the
    hand-rolled comparison the check exists to retire would come back.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T07:59:50.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """
      And the verifier allows a clock tolerance of 30 seconds

    Scenario: the claim set ten seconds past its expiry is accepted inside the thirty-second tolerance the caller states
      When I check the claims without a signature or a deployment
      Then the claims are accepted

  Rule: a claim set is judged against the instant the caller names rather than the wall clock

    Every temporal bound is a comparison against an instant, and the instant
    is an input: a caller replaying a stored claim set, reconstructing what a
    decision looked like at the time it was made, or testing one, states the
    moment it means. Substituting the wall clock answers a different question
    than the one asked, and it is wrong in the permissive direction as readily
    as the strict one.

    Background:
      Given the clock reads "2024-01-01T12:00:00.000Z"
      And the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """
      And the verifier judges the claims at "2024-01-01T08:00:00.000Z"

    Scenario: the claim set expired on the wall clock is accepted at the instant the caller named
      When I check the claims without a signature
      Then the claims are accepted

  Rule: a claim set that is not yet valid is refused

    A token must not be accepted for processing before the time `nbf` names
    (RFC 7519 §4.1.5). It is a hard lower bound and it is the one most often
    left out of a hand-rolled check, because the credential looks complete and
    its expiry has not passed; a claim set issued for a future window is then
    honoured for the whole interval before that window opens. The refusal
    names the not-before claim, so it is attributable to that bound.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T09:00:00.000Z"
      And the claims are not valid before "2024-01-01T08:30:00.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """

    Scenario: the claim set before its not-before instant is refused under that claim
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "notBefore"

  Rule: a claim set that is not yet valid is accepted when the caller waives that bound

    Each waiver names exactly one bound, so each has to be read on its own. A
    forward that enumerates the option bag by hand can carry one flag and
    drop the next, and the two failures are indistinguishable from the call
    site: the caller states two waivers, gets one, and sees a refusal that
    names a claim it thought it had already excused.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T09:00:00.000Z"
      And the claims are not valid before "2024-01-01T08:30:00.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """
      And the verifier leaves the not-before instant unchecked

    Scenario: the claim set before its not-before instant is accepted under the waiver
      When I check the claims without a signature
      Then the claims are accepted

  Rule: a claim set whose authentication time lies in the future is refused even when the caller asserts nothing about time

    `auth_time` is the time the End-User authentication occurred (OpenID
    Connect Core 1.0 §2), so a value in the future describes an authentication
    that has not happened. Refusing it is aegis policy, not an OpenID Connect
    Core requirement: a future `auth_time` would defeat every `max_age` check
    built on it, because the elapsed time since authentication reads as
    negative until that instant passes. The bound is an upper bound, like the
    one on `iat`, and refuses only an `auth_time` later than now — it is not a
    freshness bound, so an old authentication time passes. It applies by
    default, and the caller waives it by leaving the authentication time
    unchecked. The refusal names the authentication-time claim, so it is
    attributable to that bound rather than to the matcher the caller did state.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T09:00:00.000Z"
      And the claims record the authentication at "2024-01-01T08:30:00.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """

    Scenario: the claim set authenticated in the future is refused under the authentication-time claim
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "authTime"

  Rule: a claim set whose authentication time lies in the past passes the temporal window

    The authentication-time bound is an upper bound: it refuses an `auth_time`
    later than now and nothing earlier. How long ago the authentication
    happened is the caller's own question — a `max_age` check against the
    elapsed time — and not this check's, so a claim set authenticated a year
    ago passes. A bound that also refused an old `auth_time` would turn a
    policy against impossible values into a freshness requirement no caller
    asked for.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T09:00:00.000Z"
      And the claims record the authentication at "2023-01-01T08:00:00.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """

    Scenario: the claim set authenticated a year ago is accepted
      When I check the claims without a signature
      Then the claims are accepted

  Rule: a claim set whose authentication time lies in the future is accepted when the caller waives that bound

    The waiver names the authentication-time bound alone, so it has to be read
    on its own: a caller who leaves the authentication time unchecked is not
    trusting that claim, and the refusal the bound would otherwise raise does
    not apply. An option accepted and dropped leaves the bound standing, and
    the caller sees a refusal naming a claim it thought it had excused.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T09:00:00.000Z"
      And the claims record the authentication at "2024-01-01T08:30:00.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """
      And the verifier leaves the authentication time unchecked

    Scenario: the claim set authenticated in the future is accepted under the waiver
      When I check the claims without a signature
      Then the claims are accepted

  Rule: a claim set issued longer ago than the caller allows is refused

    A relying party bounds how long ago authentication may have happened
    (OpenID Connect Core 1.0 §3.1.2.1, OpenID Connect Core 1.0 §3.1.3.7); the
    same bound applies to a claim set read out of a cache or an introspection
    response, where the age is the only thing separating a current answer
    from a stale one. It is a tightening option — it can only refuse claim
    sets that would otherwise pass — so dropping it is always the unsafe
    direction, and it leaves no trace: a stale claim set passing looks exactly
    like a fresh one. The refusal names the issuance claim the bound reads.

    Background:
      Given the clock reads "2024-01-01T08:30:00.000Z"
      And the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T09:00:00.000Z"
      And the claims were issued at "2024-01-01T08:00:00.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """
      And the verifier allows an age of at most 600 seconds

    Scenario: the claim set issued thirty minutes ago is refused under a ten-minute bound
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "issuedAt"

  Rule: a claim set carrying no issuance instant is refused when the caller bounds its age

    `iat` is OPTIONAL (RFC 7519 §4.1.6), so a claim set may legitimately carry
    none — and a freshness bound cannot be evaluated against a claim that is
    absent. The bound must therefore fail closed: treating an unstated
    issuance as satisfying every age limit means the way to defeat the bound
    is to omit the claim, which is the one thing the party presenting the
    claim set can always do. The refusal names the absent claim.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier asserts
        """json
        { "subject": "user-1" }
        """
      And the verifier allows an age of at most 600 seconds

    Scenario: the claim set with no issuance instant is refused under the age bound
      When I check the claims without a signature
      Then the claims are refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "issuedAt"

  Rule: a caller stating its own bound on a temporal claim is answered by that bound alone

    The default window is a convenience, not a policy the caller cannot
    address. A caller asking a different question about the same claim — was
    this set live at a particular moment, does it expire before some deadline
    — must get the question it asked, so its own matcher replaces the default
    bound rather than being conjoined with it. Conjoining them would make the
    explicit matcher unable to widen anything, which is exactly the direction
    such a question usually goes, and the caller would have no way to tell
    the two bounds apart in the refusal.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the claims expire at "2024-01-01T07:00:00.000Z"
      And the verifier asserts an expiry no later than "2024-01-01T09:00:00.000Z"

    Scenario: the expired claim set is accepted under the caller's own expiry bound
      When I check the claims without a signature
      Then the claims are accepted
