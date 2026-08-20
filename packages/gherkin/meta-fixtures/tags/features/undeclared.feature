@nowhere-declared
Feature: scan declaration

  Scenario: still collects
    Given a noted step "undeclared"

  @operator
  Scenario: user-declared tag reused in a feature
    Given a noted step "operator"
