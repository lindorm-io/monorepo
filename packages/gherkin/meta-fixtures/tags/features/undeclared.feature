@nowhere-declared
Feature: scan declaration

  Scenario: still collects
    Given a noted step "undeclared"
    Then the note reads "undeclared"

  @operator
  Scenario: user-declared tag reused in a feature
    Given a noted step "operator"
    Then the note reads "operator"
