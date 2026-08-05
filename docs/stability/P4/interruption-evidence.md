# P4 Interruption/Reconcile Evidence

## Test Results

```
✔ P4 interruption: resume with no active feature reports nothing to do (196.430625ms)
✔ P4 interruption: resume with active feature but no drifts reports clean (159.293916ms)
✔ P4 interruption: reconcile detects evidence-missing drift (91.740791ms)
✔ P4 interruption: resume after providing evidence shows no drifts (93.472375ms)
✔ P4 interruption: interrupted voyage can be resumed (resume exits 0) (160.61425ms)
```

### What was tested

1. **No active feature** - resume reports "no active feature" with exit 0
2. **Active feature, no drifts** - resume shows correct resumeLine with feature name and phase
3. **Evidence-missing drift** - reconcile correctly detects that evidence file does not exist
4. **Evidence provided** - reconcile shows 0 drifts when evidence file exists
5. **Interrupted voyage resume** - With evidence in place, resume exits 0

### Reconcile flow

- reconcile() is read-only: creates no files, mutates nothing
- Detects evidence-missing when ref file absent from disk
- Detects evidence-failed when test output contains FAIL markers
- Detects criterion-unticked when phase is passed but checkbox not ticked
- ResumePlan includes drifts[], resumeLine, activeFeature, currentPhase
