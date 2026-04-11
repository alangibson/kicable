# §7 — Non-Functional Requirements (G1)

> Corresponds to PRD §7 Non-Functional Requirements.
> Only requirements that apply to G1 are listed; G3/G4-only items are excluded.

## §7.1 Performance

- [ ] Canvas renders 500+ nodes and 1000+ wires at ≥ 60 fps on a modern laptop (NFR-P-01)
- [ ] IndexedDB writes complete within 50 ms for single-record operations (NFR-P-02)
- [ ] PDF generation for a 500-wire harness completes within 10 seconds (NFR-P-03)

## §7.2 Reliability

- [ ] Auto-save must not block the UI thread; runs in a background worker (NFR-R-01)

## §7.3 Security

- [ ] No secrets stored in the frontend bundle (NFR-S-01)

## §7.4 Maintainability

- [ ] TypeScript monorepo with packages: `client`, `shared` (NFR-M-01)
- [ ] `shared` package contains all Zod schemas, types, and utility functions used by client (NFR-M-02)
- [ ] All internal data contracts defined via Zod schemas in `shared` and auto-validated at runtime (NFR-M-04)

## §7.5 Accessibility

- [ ] All interactive elements are keyboard navigable (NFR-A-01)
- [ ] WCAG 2.1 AA color contrast compliance (NFR-A-02)
- [ ] Canvas elements expose ARIA labels for screen reader compatibility where practical (NFR-A-03)

## Success Metrics (from §4)

- [ ] New-user time-to-first-harness-schematic < 15 minutes
- [ ] Document generation for 200-wire harness < 3 seconds in-browser
- [ ] Zero network requests during normal use — confirmed by DevTools network panel
- [ ] Full feature parity with no internet connection
- [ ] Test coverage on business logic / shared modules ≥ 80%
