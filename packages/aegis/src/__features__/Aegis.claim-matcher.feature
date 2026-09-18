Feature: The claim matcher a verify is asked beyond the floor

  A verify takes a matcher bag beside the profile: what the caller requires of
  the claims over and above the floor — which audience, which subject, which
  raw artifact a hash claim was derived from. The bag is a condition in
  `@lindorm/match`'s vocabulary, compiled at the root and inside every branch,
  and what a condition means is that package's contract as aegis applies it.
  Most rules here are therefore aegis policy and carry no tag; a citation
  appears where the row's rationale names the document that fixes the claim.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a caller asserting one audience is answered by a token naming that audience among several

    The multi-valued `aud` is the general form and a single string the special
    case, on either wire. A resource server asserting its own identity asks
    whether it is among the audiences, never whether it is the only one, so a
    matcher compiled to an equality test answers no for every token in the
    general form — and the deployments it breaks are exactly the ones whose
    issuer did the ordinary thing.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/"                              |
        | sub | "user-1"                                                |
        | aud | ["https://rs.lindorm.io/", "https://other.lindorm.io/"] |
        | jti | "token-1"                                               |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier asserts
        """json
        { "audience": "https://rs.lindorm.io/" }
        """

    @RFC-7519
    Scenario: jose: a verifier among the audiences is answered by the token (RFC-7519 §4.1.3)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then the verified token is a "jwt"

    @RFC-8392
    Scenario: cose: a verifier among the audiences is answered by the token (RFC-8392 §3.1.3)
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then the verified token is a "cwt"

  Rule: a caller asserting an audience the token does not name is refused

    Containment is only a check if the absent case fails. A matcher relaxed
    until every token satisfies it is worse than no matcher: the caller
    believes the token was checked against its own identity and stops
    checking, which is the exact state a replayed token needs to be useful.
    The refusal names the audience matcher, so it is attributable to the
    caller's assertion and not to the floor.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/"                              |
        | sub | "user-1"                                                |
        | aud | ["https://rs.lindorm.io/", "https://other.lindorm.io/"] |
        | jti | "token-1"                                               |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier asserts
        """json
        { "audience": "https://elsewhere.lindorm.io/" }
        """

    Scenario Outline: <wire>: a verifier the audience does not name is refused
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "audience"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a caller presenting the raw access token, code and state is answered from the hash claims the token carries

    The three hash claims come from two specifications and are defined the
    same way in each: `at_hash` over the access token and `c_hash` over the
    code (OpenID Connect Core 1.0 §3.1.3.6, OpenID Connect Core 1.0 §3.3.2.11),
    and `s_hash` over the `state`, which OpenID Connect Core does not define
    (Financial-grade API Security Profile 1.0 Part 2 §5.1.1). All three take
    the hash function from the id token's `alg` header parameter. A relying
    party holds the raw artifacts, never the digests, so the comparison has to
    happen where the signing algorithm is known. The three are presented
    together, as the row states them: a scenario per source would prove each
    derivation alone and never that they share one bag. The cose scenario
    carries no tag: every cited document defines its claim over a JOSE
    header's `alg`, and none of them gives a CWT one.

    Background:
      Given the content to mint
        | subject     | user-1                                                                                           |
        | accessToken | 12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c |
        | authCode    | 999a8b01e27c56aeb5b2f47c001ef8be7be39a375f8c5e929f82df1626de01d8                                 |
        | authState   | 7409ac52a9615b8c9f9a                                                                             |
      And the token type "test_token"
      And the content expires in "1h"
      And the verifier asserts
        """json
        {
          "accessToken": "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c",
          "authCode": "999a8b01e27c56aeb5b2f47c001ef8be7be39a375f8c5e929f82df1626de01d8",
          "authState": "7409ac52a9615b8c9f9a"
        }
        """

    @openid-connect-core-1_0
    @openid-financial-api-part-2-1_0
    Scenario: jose: the raw artifacts are hashed with the token's algorithm and answered by the digests it carries (OpenID Connect Core 1.0 §3.1.3.6) (OpenID Connect Core 1.0 §3.3.2.11) (Financial-grade API Security Profile 1.0 Part 2 §5.1.1)
      When I mint the content under the "default" profile on the jose wire
      And I verify the token
      Then the verified token is a "jwt"

    Scenario: cose: the raw artifacts are hashed with the token's algorithm and answered by the digests it carries
      When I mint the content under the "default" profile on the cose wire
      And I verify the token
      Then the verified token is a "cwt"

  Rule: a caller presenting an access token the id token was not issued for is refused

    The `at_hash` binding is what lets a relying party detect an access token
    substituted for the one the id token was issued alongside. It therefore
    has to fail for the substituted artifact — a derivation that computed a
    digest and then compared nothing would report success for every pair,
    which is the single condition the claim was added to make detectable. The
    cose scenario carries no tag: OpenID Connect Core defines the claim over a
    JOSE header's `alg`, and no document this row cites gives a CWT one.

    Background:
      Given the content to mint
        | subject     | user-1                                                                                           |
        | accessToken | 12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c |
      And the token type "test_token"
      And the content expires in "1h"
      And the verifier asserts
        """json
        { "accessToken": "a-different-access-token" }
        """

    @openid-connect-core-1_0
    Scenario: jose: the substituted access token is refused under the raw source the caller presented (OpenID Connect Core 1.0 §3.1.3.6)
      When I mint the content under the "default" profile on the jose wire
      And I verify the token
      Then verification is refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "accessToken"

    Scenario: cose: the substituted access token is refused under the raw source the caller presented
      When I mint the content under the "default" profile on the cose wire
      And I verify the token
      Then verification is refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "accessToken"

  Rule: a caller writing a condition operator under a raw hash source key is refused as unsupported

    A raw source key names a value aegis hashes with the function the token's
    `alg` selects (OpenID Connect Core 1.0 §3.1.3.6) before comparing it to the
    digest claim; a condition operator names a comparison over the claim as it
    is carried. The two readings cannot both hold for one key: hashing the
    operand makes it meaningless, and applying the operator to the digest
    compares an unhashed value to a digest, which fails for the genuine source
    and reports a substituted artifact. Aegis policy: a key that means a source
    to be hashed refuses any value it cannot hash, and names the key the caller
    wrote.

    Background:
      Given the content to mint
        | subject     | user-1                                                                                           |
        | accessToken | 12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c |
      And the token type "test_token"
      And the content expires in "1h"
      And the verifier asserts
        """json
        { "accessToken": { "$eq": "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c" } }
        """

    Scenario Outline: <wire>: the operator is refused as an unsupported value, naming the raw source key
      When I mint the content under the "default" profile on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "jwt_verify_unsupported_value"
      And the refusal names the matcher "accessToken"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a caller bounding the issuer with a condition is refused by a token naming another issuer

    An issuer bound is rarely a bare equality: a client accepting tokens from
    several deployments, or accepting one only when the claim is present at
    all, states that as a condition. A surface that took the condition and
    compared it as a value would find no token whose `iss` equals an object, so
    it could only ever refuse — and one that ignored it could only ever
    accept. The refusing direction is the one pinned, because an unevaluated
    matcher fails open: the caller stated a bound and every issuer satisfies
    it.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier asserts
        """json
        { "issuer": { "$or": [{ "$exists": false }, { "$eq": "https://other.lindorm.io/" }] } }
        """

    Scenario Outline: <wire>: the condition is evaluated and the issuer that satisfies neither branch is refused
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "issuer"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a profiled verify refuses a caller matcher the token does not satisfy even when the profile floor passes

    The profiled call takes the same matcher argument as the profile-less one,
    and a caller passing one states a requirement the profile knows nothing
    about. A path that satisfied the floor and dropped the matcher would report
    success on the profile alone, so the caller's requirement would be silently
    unenforced while every profile rule still looked like it was working. The
    construction is what makes the refusal attributable: the floor's own
    audience is satisfied by the same token, so nothing but the caller's
    matcher can be refusing it.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the verifier asserts
        """json
        { "audience": "https://other.lindorm.io/" }
        """

    Scenario Outline: <wire>: the token passing the floor is refused by the caller's matcher
      When I mint the content under the "access_token" profile on the <wire> wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "claims_invalid"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a refused claim matcher is reported under the domain claim name the caller stated it with

    The domain surface exists so a caller states claims in one vocabulary and
    never has to know the wire's, and it does so precisely because the wire
    spellings diverge: the token id is `jti` on JOSE and `cti` on COSE
    (RFC 7519 §4.1.7, RFC 8392 §3.1.7). A refusal that reported the wire name
    would hand that divergence straight back — a name the caller never wrote,
    and a different one depending on which encoding the issuer chose. Aegis
    policy on the read surface: the list speaks the caller's vocabulary, and
    the token id is the matcher that makes the consequence undeniable.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier asserts
        """json
        { "tokenId": "not-the-token-id" }
        """

    Scenario Outline: <wire>: the refusal names the token id as the caller spelled it
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "tokenId"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a caller stating a conjunction of claim matchers is answered by a token satisfying every member

    A matcher argument is a condition, and a condition composes: a caller whose
    requirement is a conjunction of two claim matchers writes it as one,
    because the alternative is two calls that cannot share a verdict. A
    surface that read a composed condition as a claim name would find no such
    claim on any token and refuse every caller who composed one, so the
    accepting direction is what shows the composition was compiled rather than
    named.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And the token type "test_token"
      And the content expires in "1h"
      And the verifier asserts
        """json
        { "$and": [{ "subject": "user-1" }, { "clientId": "client-1" }] }
        """

    Scenario Outline: <wire>: the token satisfying every member verifies
      When I mint the content under the "default" profile on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: a caller stating a conjunction is refused by a token failing one member, and the refusal names the conjunction

    A conjunction holds only when every member does, so a token failing one
    member fails the whole. The refusal names the top-level entries of the
    matcher argument that did not hold, and a root operator is a top-level
    entry of its own: the caller wrote `$and`, and `$and` is what did not
    hold. Naming the member's claim instead would require the diagnosis to
    descend into a structure whose failing member is not always one claim.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And the token type "test_token"
      And the content expires in "1h"
      And the verifier asserts
        """json
        { "$and": [{ "subject": "user-1" }, { "clientId": "someone-else" }] }
        """

    Scenario Outline: <wire>: the token failing one member is refused under the conjunction's own key
      When I mint the content under the "default" profile on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "$and"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a caller stating a disjunction is answered by a token satisfying only its second member

    A disjunction is how a caller states that either of two identities is
    acceptable — a token for the previous subject or the current one during a
    migration. It holds when any member does, and the member that holds must
    not have to be the first: a surface that evaluated only the first member
    would refuse every token the caller admitted through the second, and read
    as a working disjunction on every test that names the accepted identity
    first.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the token type "test_token"
      And the content expires in "1h"
      And the verifier asserts
        """json
        { "$or": [{ "subject": "someone-else" }, { "subject": "user-1" }] }
        """

    Scenario Outline: <wire>: the token satisfying the second member alone verifies
      When I mint the content under the "default" profile on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: a caller negating a claim matcher is refused by a token matching the negated matcher, and the refusal names the negation

    A negation is how a caller excludes an identity — a token for a revoked
    client, a subject that must not reach this resource. It fails exactly when
    its payload holds, and the refusal names the entry that failed, which is
    `$not`: the claim inside the negation did not fail, it matched, and naming
    it as failing would tell the caller the opposite of what happened. The
    diagnosis evaluates each top-level entry against the whole claim set,
    because a negation has no claim of its own to read.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the token type "test_token"
      And the content expires in "1h"
      And the verifier asserts
        """json
        { "$not": { "subject": "user-1" } }
        """

    Scenario Outline: <wire>: the token matching the negated matcher is refused under the negation's own key
      When I mint the content under the "default" profile on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "$not"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a caller stating a raw access token inside a disjunction is answered by the id token issued alongside it

    The `at_hash` binding (OpenID Connect Core 1.0 §3.1.3.6) is stated with the
    raw access token, and aegis derives the digest with the hash function the
    token's `alg` selects. A branch of a condition is compiled exactly as the
    root is, so a raw source inside one is derived there too — a compile that
    derived only at the root would compare the raw source literally to the
    digest inside a branch, which matches no genuine pair and reads as a
    substituted access token. The satisfying member is placed second so that
    the accept can only come from a branch that was derived.

    Background:
      Given the content to mint
        | subject     | user-1                                                                                           |
        | accessToken | 12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c |
      And the token type "test_token"
      And the content expires in "1h"
      And the verifier asserts
        """json
        {
          "$or": [
            { "accessToken": "a-different-access-token" },
            { "accessToken": "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c" }
          ]
        }
        """

    Scenario Outline: <wire>: the raw source in the second branch is derived and the token verifies
      When I mint the content under the "default" profile on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: a caller stating the raw source in one branch and the digest claim in another is answered on content

    A raw source and its digest claim resolve to one wire claim, and stating
    both in one matcher object is refused because only one of them could be
    checked. Two branches of a disjunction are two matcher objects, each
    compiled on its own: the raw source is checked in one and the digest in
    the other, and nothing is displaced. A refusal that reached across
    branches would forbid the one construction — accept the digest I hold or
    the source I was handed — that a disjunction over a binding exists to
    state.

    Background:
      Given the content to mint
        | subject     | user-1                                                                                           |
        | accessToken | 12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c |
      And the token type "test_token"
      And the content expires in "1h"
      And the verifier asserts
        """json
        {
          "$or": [
            { "accessToken": "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c" },
            { "accessTokenHash": "a-digest" }
          ]
        }
        """

    Scenario Outline: <wire>: the two branches do not collide and the token verifies on the derived branch
      When I mint the content under the "default" profile on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: a caller leaving the raw source undefined beside a wrong digest claim is refused under the digest claim

    An `undefined` matcher is not stated (`@lindorm/match`: it means "not
    specified"), so it takes part in nothing — neither the predicate nor the
    vocabulary a refusal is reported in. The raw source and its digest claim
    share one wire claim, so a report that read the unstated key would name
    it for a failure the stated key produced, and the caller would be told a
    matcher they never wrote is wrong.

    Background:
      Given the content to mint
        | subject     | user-1                                                                                           |
        | accessToken | 12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c |
      And the token type "test_token"
      And the content expires in "1h"
      And the verifier asserts
        """json
        { "accessTokenHash": "a-wrong-digest" }
        """
      And the verifier's matcher "accessToken" is left undefined

    Scenario Outline: <wire>: the refusal names the digest claim the caller stated, never the unstated source
      When I mint the content under the "default" profile on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "accessTokenHash"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a caller stating the raw source beside the digest claim inside one branch is refused as conflicting matchers

    The refusal of a raw source stated beside its digest claim is about the
    matcher object the two share, and a branch is a matcher object: inside it
    the two resolve to one wire claim and the second would displace the first
    exactly as at the root. A rule that held at the root and lapsed one level
    down would let the verdict turn on key order for any caller who composed
    their matcher. The refusal names both keys, so the caller sees the pair
    that met rather than one of them.

    Background:
      Given the content to mint
        | subject     | user-1                                                                                           |
        | accessToken | 12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c |
      And the token type "test_token"
      And the content expires in "1h"
      And the verifier asserts
        """json
        {
          "$or": [
            {
              "accessToken": "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c",
              "accessTokenHash": "a-digest"
            }
          ]
        }
        """

    Scenario Outline: <wire>: the pair inside the branch is refused as conflicting, naming both keys
      When I mint the content under the "default" profile on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "jwt_verify_conflicting_matchers"
      And the refusal names the conflicting matchers "accessToken", "accessTokenHash"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an expired token is refused even when the caller's matcher is a disjunction the token satisfies

    The temporal window is a bound the verifier applies, never a matcher the
    caller composes: `exp` is the instant on or after which the token must
    not be accepted for processing, and that obligation does not enter into
    any disjunction the caller writes. It is applied beside the caller's
    matcher at the root, so a composed matcher the token satisfies changes
    nothing about an expiry it has passed — a window that joined the caller's
    disjunction as one more member would be satisfied by whichever member the
    caller made true. The refusal is the wire reader's own and names `exp`,
    which is what shows the window fired and not the matcher. The cose
    scenario carries no tag: the rule is the JWT specification's, a CWT is
    not a JWT, and RFC 8392 §3.1.4 gives its own expiry claim the same meaning
    and processing rules by reference — a document this row does not cite.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T06:00:00.000Z"
      And the wire claims expire at "2024-01-01T07:00:00.000Z"
      And the verifier asserts
        """json
        { "$or": [{ "subject": "user-1" }] }
        """

    @RFC-7519
    Scenario: jose: the expiry bound refuses the token whatever the satisfied disjunction says (RFC-7519 §4.1.4)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then verification is refused as a JOSE error
      And the refusal lists the invalid claims "exp"

    Scenario: cose: the expiry bound refuses the token whatever the satisfied disjunction says
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then verification is refused as a COSE error
      And the refusal lists the invalid claims "exp"

  Rule: a caller stating a disjunction with no member is answered with the matcher's own error

    A disjunction with no member is not a condition a token can satisfy or
    fail: the matcher vocabulary refuses the shape outright rather than
    deciding it (`@lindorm/match`: omit the key to place no constraint), so it
    is the caller's coding error and says nothing about the token. Aegis
    reports it as itself — the matcher's `TypeError`, never an aegis error —
    because a coding error dressed as a claims verdict sends an operator to
    the token when the fault is in the call.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the token type "test_token"
      And the content expires in "1h"
      And the verifier asserts
        """json
        { "$or": [] }
        """

    Scenario Outline: <wire>: the empty disjunction is refused as the matcher's own error, not a verdict
      When I mint the content under the "default" profile on the <wire> wire
      And I verify the token
      Then verification is refused as the matcher's own error

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a caller negating a value that is not a condition is answered with the matcher's own error

    A negation takes a condition, so a `$not` whose payload is not an object
    states nothing a token can be tested against; `@lindorm/match` refuses
    the shape rather than answering it, which makes it the caller's coding
    error and never a verdict about the token. Aegis reports it as itself —
    the matcher's `TypeError`, never an aegis error.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the token type "test_token"
      And the content expires in "1h"
      And the verifier asserts
        """json
        { "$not": "x" }
        """

    Scenario Outline: <wire>: the negated non-condition is refused as the matcher's own error, not a verdict
      When I mint the content under the "default" profile on the <wire> wire
      And I verify the token
      Then verification is refused as the matcher's own error

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a caller negating an empty condition is refused by every token

    An empty condition constrains nothing and every claim set satisfies it
    (`@lindorm/match`), so its negation is satisfied by none. Aegis compiles
    the shape through and lets the matcher decide it: the negation fails, and
    the refusal names the entry the caller wrote.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the token type "test_token"
      And the content expires in "1h"
      And the verifier asserts
        """json
        { "$not": {} }
        """

    Scenario Outline: <wire>: the negated empty condition refuses the token under the negation's own key
      When I mint the content under the "default" profile on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "$not"

      Examples:
        | wire |
        | jose |
        | cose |
