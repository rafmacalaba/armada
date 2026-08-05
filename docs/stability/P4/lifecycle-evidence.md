# P4 Lifecycle Evidence

## Test: init -> doctor -> voyage -> evidence -> update -> repeat -> uninstall

```
✔ P4 lifecycle: init -> doctor -> voyage -> evidence -> update -> repeat -> uninstall (7575.511292ms)
✔ P4 lifecycle: repeated init does not corrupt opencode.json (245.971125ms)
✔ P4 lifecycle: uninstall --all removes all armada files (181.271458ms)
```

### What was tested

1. **init** - Scaffold armada team into temp git repo from manifest
2. **doctor** - All health checks pass with mock opencode binary
3. **voyage** - Mock tmux creates session, sends prompt (no hang, completes within timeout)
4. **evidence** - Doctor run as evidence collection
5. **update** - Re-init with --restart overwrites armada-owned files
6. **repeat** - Second doctor pass confirms stability
7. **uninstall** - Removes all armada artifacts

### Key assertions

- init exits 0 with "Scaffolded" output
- doctor exits 0 with all checks passing
- voyage does not hang (completes within 5s timeout)
- re-init (update) exits 0
- uninstall exits 0, armada.yaml removed
- Repeated init does not corrupt opencode.json (valid JSON with model + default_agent)
- uninstall --all removes AGENTS.md, opencode.json, REQUIREMENTS.md; preserves user files
