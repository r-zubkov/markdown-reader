# CHG-NNN Requirements-quality checklist: <focus>

## Ownership

This is a reviewer-owned requirements-quality gate. `[x]` means the reviewer determined that the requirement-quality criterion is satisfied; it does not mean implementation is complete. An implementation agent must not change these markers unless the reviewer explicitly asks it to assist with the evaluation.

## Completeness

- [ ] Every priority user scenario has testable acceptance examples.
- [ ] Loading, empty, error, disabled, interrupted and recovery behavior is specified where applicable.
- [ ] In-scope and out-of-scope boundaries are explicit.

## Clarity

- [ ] No material `[NEEDS CLARIFICATION: ...]` marker remains.
- [ ] Terms and state transitions have one unambiguous meaning.
- [ ] Success criteria measure outcomes rather than implementation details.

## Safety and compatibility

- [ ] Data-integrity, privacy and security consequences are explicit.
- [ ] Compatibility, migration and rollback expectations are explicit where applicable.
- [ ] Accessibility, responsive, localization and offline impacts are explicit where applicable.

## Traceability

- [ ] Durable requirement/decision changes identify their canonical owner.
- [ ] Every requirement can map to implementation and verification work.
- [ ] No checklist item is being used as a substitute for an unresolved product decision.

## Reviewer notes

- Reviewer:
- Reviewed date:
- Blocking findings:
- Required source-artifact updates:
