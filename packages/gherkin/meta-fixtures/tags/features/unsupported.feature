Feature: reserved skip tag

  @skip
  Scenario: imported from another runner
    Given a noted step "skip"
    Then the note reads "skip"
