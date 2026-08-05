# P4 Parallel Docks Evidence

## Test: Two independent docks init and uninstall without conflict

```
✔ P4 parallel docks: two independent docks init and uninstall without conflict (1091.568333ms)
✔ P4 parallel docks: concurrent init does not corrupt either dock (272.019166ms)
```

### What was tested

1. Two disjoint temp git repos created with different project names ("dock-a", "dock-b")
2. Both init'd with absolute manifest paths
3. Both have correct agent files (all 8 roles)
4. armada.yaml contents differ (dock-a vs dock-b project names)
5. Doctor passes on both
6. Uninstall clean on both - no conflict
7. Concurrent init via Promise.all does not corrupt either dock
8. Both have valid opencode.json after concurrent init

### Key assertions

- armada.yaml for dockA contains "dock-a", dockB contains "dock-b"
- yamlA !== yamlB (independent manifests)
- Doctor exits 0 for both
- Uninstall exits 0 for both, armada.yaml removed in both
- Concurrent init: both exit 0, both have valid opencode.json
