## What changed


## Checks

- [ ] `npm test` passes
- [ ] `npm run smoke` passes, if a page, chunking or a dependency changed
- [ ] Version bumped and `CHANGELOG.md` updated, if the app changed

## A new equation method in `src/lib/solvers/algebra/`

- [ ] Registered in `tests/helpers/equationMethods.js` (the suite fails if it is not)
- [ ] Families cover π, e, decimals, fractions, square roots, x in a denominator, true everywhere and true nowhere
- [ ] `answered` is set, so the method itself has to be the one answering
- [ ] Exact tests cover what a grid scan cannot see: a repeated root, the exact form of the answer
- [ ] A bug planted in a copy made a family fail
