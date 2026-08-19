Feature: disposal throw

  Scenario: disposal continues past the throwing context
    Given a disposing step

  Scenario: a step failure stays primary and the disposal failure appends
    Given a disposing step that fails
