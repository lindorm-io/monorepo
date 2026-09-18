Feature: The domain round trip

  What a caller states through `mint` and what the audience reads back through
  `verify`. Every claim on that path is translated to a wire name on the way
  out and resolved back on the way in, so a claim lost, renamed or mis-bucketed
  between the two is a statement the issuer believes it made and nobody
  receives.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a minted token is read back by the domain verify in the vocabulary it was stated in

    The encoding the issuer chose must not change what the audience can read,
    because the choice is the issuer's and the consequence is the audience's.
    The structure is read off the bytes: without that, the rule would be aegis
    reporting the format it decided the bytes were, which a writer and a reader
    that agreed on the wrong structure would also report correctly.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And a scope list whose members are "read", "write"

    Scenario Outline: <wire>: the profiled verify accepts the token and reports its format
      When I mint the content under the "access_token" profile on the <wire> wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    Scenario Outline: <wire>: the audience reads back every claim in the vocabulary the caller stated it in
      When I mint the content under the "access_token" profile on the <wire> wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified claims include
        | subject  | user-1                   |
        | clientId | client-1                 |
        | issuer   | https://test.lindorm.io/ |
      And the verified claims list the audience "https://rs.lindorm.io/"
      And the verified claims list the scope "read", "write"

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario: jose: a claims-bearing token is a three-part compact serialisation
      When I mint the content under the "access_token" profile on the jose wire
      Then the raw token is a compact serialisation of 3 parts

    Scenario: cose: a claims-bearing token is a CWT-tagged COSE_Sign1
      When I mint the content under the "access_token" profile on the cose wire
      Then the raw token carries the CBOR tag chain 61, 18

  Rule: a minted scope reaches the wire as a single space-delimited string on either encoding

    The list is the domain's vocabulary and the one string is the wire's, on
    both encodings. A recipient is written against the registered wire form: an
    array put there instead parses only for readers that tolerate an
    unregistered spelling, and every token carrying one teaches its consumers
    to accept a shape no specification defines.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And a scope list whose members are "read", "write"

    @RFC-8693
    Scenario: jose: the scope list travels as one space-separated string under its registered JWT claim name (RFC-8693 §4.2)
      When I mint the content under the "access_token" profile on the jose wire
      Then the raw payload carries "scope" "read write"

    @RFC-9200
    Scenario: cose: the scope list travels as one text string under its registered CWT claim key (RFC-9200 §8.14)
      When I mint the content under the "access_token" profile on the cose wire
      Then the raw payload carries claim key 9 "read write"

  Rule: minting a token whose scope list has a member containing a space is refused

    The wire form of `scope` is one space-delimited string, so a member
    containing a space joins to bytes indistinguishable from two members, and
    every reader of the token — this package's own included — reports a list
    the caller never stated. Aegis policy at mint (RFC 6749 §3.3): the member is
    refused, and the refusal names its position so the caller repairs the value
    rather than the claim.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And a scope list whose only member is "read write"

    Scenario Outline: <wire>: the mint is refused, locating the fault at the member
      When I mint the content under the "access_token" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "scope" and locates the fault at "scope[0]": Member "scope[0]" must not contain a space

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: minting under a profile that demands a scope refuses a member containing a space for its shape, not its presence

    A profile demanding `scope` is satisfied by the caller who supplied one, so
    the fault in a member containing a space is the member's shape and nothing
    else — aegis policy at mint (RFC 6749 §3.3). A caller told the claim is
    missing looks for a field they already wrote; one told which member is
    malformed repairs it. No built-in profile demands a scope, so the rule is
    stated against one registered through the public door.

    Background:
      Given a registered profile "scoped_access" that demands the claims "subject", "audience", "scope"
      And the content to mint
        | subject | user-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And a scope list whose only member is "read write"

    Scenario Outline: <wire>: the refusal names the member's shape rather than the claim's presence
      When I mint the content under the "scoped_access" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "scope" and locates the fault at "scope[0]": Member "scope[0]" must not contain a space

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: minting a token whose scope list has an empty member is refused

    An empty member joins to a separator with nothing on one side of it, and
    this package's own reader reports a list one member shorter than the caller
    stated. Aegis policy at mint (RFC 6749 §3.3): the member is refused, and the
    refusal names its position.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And a scope list whose members are "", "read"

    Scenario Outline: <wire>: the mint is refused, locating the fault at the member
      When I mint the content under the "access_token" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "scope" and locates the fault at "scope[0]": Member "scope[0]" must not be empty

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: minting a token whose scope list has a member containing a double quote is refused

    A `scope` member is a `scope-token`, and `%x22` sits outside every range the
    production admits. Aegis policy at mint (RFC 6749 §3.3): a member the
    production does not spell is refused rather than signed, and the refusal
    names its position.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And a scope list whose only member is 're"ad'

    Scenario Outline: <wire>: the mint is refused, locating the fault at the member
      When I mint the content under the "access_token" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "scope" and locates the fault at "scope[0]": Member "scope[0]" must contain only scope-token characters (RFC 6749 §3.3)

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: minting a token whose scope list has a member containing a non-ASCII code point is refused

    A `scope` member is a `scope-token`, whose every range ends below `%x7F`, so
    a code point outside ASCII has no spelling in it. Aegis policy at mint
    (RFC 6749 §3.3): the member is refused rather than signed, and the refusal
    names its position.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And a scope list whose only member is "läs"

    Scenario Outline: <wire>: the mint is refused, locating the fault at the member
      When I mint the content under the "access_token" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "scope" and locates the fault at "scope[0]": Member "scope[0]" must contain only scope-token characters (RFC 6749 §3.3)

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a minted scope list whose members span the scope-token ranges is read back unchanged

    Every character the `scope-token` production admits must ride: a member
    spelt from the edges of its three ranges is as valid as `read`, and a writer
    that refused one would deny the deployment a vocabulary the specification
    grants.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And a scope list whose members are "read", "write:all", "urn:x", "a!#[]~"

    @RFC-8693
    Scenario: jose: the list joins to one space-delimited string under its registered JWT claim name (RFC-8693 §4.2)
      When I mint the content under the "access_token" profile on the jose wire
      Then the raw payload carries "scope" "read write:all urn:x a!#[]~"

    @RFC-9200
    Scenario: cose: the list joins to one space-delimited text string under its registered CWT claim key (RFC-9200 §8.14)
      When I mint the content under the "access_token" profile on the cose wire
      Then the raw payload carries claim key 9 "read write:all urn:x a!#[]~"

    @RFC-6749
    Scenario Outline: <wire>: every member the scope-token production admits is read back in order and unaltered (RFC-6749 §3.3)
      When I mint the content under the "access_token" profile on the <wire> wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified claims list the scope "read", "write:all", "urn:x", "a!#[]~"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a caller asserting one scope is answered by the space-delimited wire claim containing it

    A single scope named at verify is a containment question about the list the
    token grants — the same question the static matcher answers over a claim
    dict. On the wire that list is one space-separated string (RFC 8693 §4.2),
    so the matcher is answered against the list the string spells: answered
    against the string itself, containment fails for every token whose grant
    should satisfy it, and the deployment's gate refuses every request at the
    one call site it believes is doing the gating.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And a scope list whose members are "read", "write"

    Scenario Outline: <wire>: a verify asserting one scope is satisfied by the token that grants it
      When I mint the content under the "access_token" profile on the <wire> wire
      And I verify the token asserting the scope "read"
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    Scenario Outline: <wire>: the verified claims still report the whole scope list
      When I mint the content under the "access_token" profile on the <wire> wire
      And I verify the token asserting the scope "read"
      Then the verified claims list the scope "read", "write"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a minted roles claim reaches the wire as the array of strings it was stated as

    `roles` is encoded per SCIM guidance — an array of strings — and no string
    form is provided for it, so the array is the registered wire shape. The
    space-delimited form belongs to `scope`'s own registration (RFC 8693 §4.2)
    and to nothing beside it. `roles` has only a lindorm private-use integer
    label and a mint is interoperable by default, so the claim rides both wires
    under its registered string name.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And a roles list whose members are "role-a", "role-b"

    @RFC-9068
    Scenario Outline: <wire>: the roles list travels as an array of strings under its registered name (RFC-9068 §2.2.3.1)
      When I mint the content under the "access_token" profile on the <wire> wire
      Then the raw payload carries "roles" as the list "role-a", "role-b"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a verified token carries the claims exactly as they arrived on the wire

    A consumer that forwards, re-emits or logs a token must be able to
    reproduce what it received, and the domain claim buckets cannot answer
    that: they are the result of a translation that renames claims, splits them
    across buckets and decodes their values. `scope` is the sharpest case: the
    wire carries one space-delimited string (RFC 8693 §4.2) while every domain
    surface speaks the list, so a matcher pass that lifts the string for its
    own comparison must leave the reported payload carrying the string the
    issuer signed.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the token type "test_token"
      And the content expires in "1h"
      And a scope list whose members are "read", "write"

    Scenario Outline: <wire>: the untranslated payload keeps the wire names the token arrived with
      When I mint the content under the "default" profile on the <wire> wire
      And I verify the token asserting the scope "read"
      Then the untranslated payload carries "sub" "user-1"
      And the untranslated payload carries "iss" "https://test.lindorm.io/"

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: the untranslated payload keeps the scope as the one string the issuer signed, though a matcher lifted it
      When I mint the content under the "default" profile on the <wire> wire
      And I verify the token asserting the scope "read"
      Then the untranslated payload carries "scope" "read write"

      Examples:
        | wire |
        | jose |
        | cose |
