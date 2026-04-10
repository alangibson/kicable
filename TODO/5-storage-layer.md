# §5 — Storage Layer (G1)

> Corresponds to PRD §5.2 Deployment Configurations — StorageAdapter abstraction.
> In G1 the only active adapter is IndexedDB. The interface must be designed so G3 can
> swap in an API adapter with no changes to application code.

- [ ] Define `StorageAdapter` interface in `shared` (methods: project CRUD, library CRUD, blob store)
- [ ] Implement `IndexedDBAdapter` in `client` using `idb` (typed, promise-based)
  - [ ] Store projects, libraries, images (ArrayBuffer keyed by `component_id/image_id`), and STEP files
  - [ ] Warn user when IndexedDB quota approaches limit
  - [ ] Warn user when a STEP file exceeds 50 MB before storing
- [ ] Wire `IndexedDBAdapter` as the active adapter when `VITE_BACKEND_URL` is unset
