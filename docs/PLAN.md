# Obsius Development Plan

## Settings Persistence Strategy

### Current Approach: Clean Break (Pre-1.0.0)

Prior to version 1.0.0, Obsius follows a **clean break** strategy for settings:

- **Schema version mismatch**: Settings are reset to defaults
- **Validation failure**: Settings are reset to defaults
- **No field-level migrations**: Only schema version tracking

This approach keeps the codebase simple during rapid iteration. Users who update the plugin may need to reconfigure their settings after schema changes.

### Rationale

1. **Simplicity**: No migration code to maintain or test
2. **Rapid iteration**: Schema changes are cheap (just bump version + update defaults)
3. **Low risk**: Pre-1.0.0 users expect breaking changes
4. **Minimal user impact**: Settings are simple enough that reconfiguration is trivial

### Post-1.0.0 Migration Strategy

After reaching version 1.0.0, we will implement proper migration strategies:

1. **Version-to-version migrations**: Incremental transforms (vN → vN+1)
2. **Field-level migrations**: Preserve user settings across schema changes
3. **Migration testing**: Automated tests for each migration path
4. **Graceful degradation**: Attempt partial migration even if full migration fails

### Implementation Plan

When 1.0.0 approaches:

1. Audit current settings schema and predict likely evolution
2. Design migration framework (e.g., registry of version transformers)
3. Implement migrations for each major schema change
4. Add migration tests
5. Document migration strategy for contributors

---

*This document will be updated as the project approaches 1.0.0.*
