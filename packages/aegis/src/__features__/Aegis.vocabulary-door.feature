Feature: The claim vocabulary door

  The read half of the vocabulary pair: a flat claim dict that arrived some other
  way — an introspection response, a userinfo body — resolved into the same four
  buckets a verified token carries, so a consumer never re-derives the registry
  from its own copy of the claim categories. The door takes the WIRE vocabulary
  and only that one. No scenario names a wire: the input is a claim dict rather
  than a token, so neither encoding is involved. None carries a tag either — the
  cited documents state processing rules for a token, and the strictness below is
  aegis policy.

  Rule: a claim stated under its domain name is refused rather than translated

    Nothing signs this door's input, so which spelling arrives is chosen by
    whoever wrote the dict. A door answering to both is a door on which one claim
    can be stated twice, and then some rule has to decide which half wins and
    what becomes of the loser — a decision no consumer can audit and one an
    attacker picks. Refusing by name costs a caller one spelling and leaves the
    door with a single reading. It is the rule the declared structures already
    hold one level in, where a member named in the domain vocabulary collides
    with the member it impersonates and is refused.

    Scenario: the claim stated under its wire name is read into the domain vocabulary
      Given the claim dict
        | client_id | "c1" |
      When I read the claim dict into the domain vocabulary
      Then the domain claims are
        | clientId | "c1" |
      And the custom bucket is empty

    Scenario: the claim stated under its domain name is refused, naming the spelling it wants
      Given the claim dict
        | clientId | "c1" |
      When I read the claim dict into the domain vocabulary
      Then the read is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "clientId" and locates the fault at "clientId": Claim "clientId" must be stated under its wire name "client_id"

    Scenario: the dict carrying both spellings of one claim is refused
      Given the claim dict
        | sub     | "wire-spelling"   |
        | subject | "domain-spelling" |
      When I read the claim dict into the domain vocabulary
      Then the read is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "subject" and locates the fault at "subject": Claim "subject" must be stated under its wire name "sub"

    Scenario: the claim whose domain name is its own wire name is read, not refused
      Given the claim dict
        | scope  | "openid profile" |
        | groups | ["staff"]        |
      When I read the claim dict into the domain vocabulary
      Then the domain claims are
        | scope  | ["openid", "profile"] |
        | groups | ["staff"]             |
      And the custom bucket is empty

  Rule: a key the registry does not declare keeps its place in the custom bucket

    The refusal reads a key as it arrives, so it reaches the names the registry
    declares and no others. An unregistered key has no domain spelling to be
    stated in the wrong one, and the door carries it under the camelCase form the
    token read gives it — including the key whose camelCase form happens to be
    some claim's domain name, which is an unregistered key all the same and not a
    claim spelled in the wrong vocabulary.

    Scenario: the unregistered key is carried into the custom bucket, camelCased
      Given the claim dict
        | sub        | "user-1" |
        | tenant_ref | "acme"   |
      When I read the claim dict into the domain vocabulary
      Then the domain claims are
        | subject | "user-1" |
      And the custom claims are
        | tenantRef | "acme" |

    Scenario: the unregistered key whose camelCase form is a claim's domain name is carried, not refused
      Given the claim dict
        | sub        | "user-1"   |
        | expires_at | 1704099600 |
      When I read the claim dict into the domain vocabulary
      Then the domain claims are
        | subject | "user-1" |
      And the custom claims are
        | expiresAt | 1704099600 |
