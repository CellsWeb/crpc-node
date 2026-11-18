# Workspace example

This private example uses the local workspace SDK, not public npm latest. From
the monorepo run pnpm install and pnpm build, then use this directory's typecheck,
test, dev/build/start scripts. Node 24 LTS is primary; source guide examples are in
../docs. Replace authentication stubs with your application verifier.

Docs are configured globally; deprecated isPublic is ignored. The example is
not automatically a production identity provider or security audit certificate.
Use ../RELEASE.md for release engineering and ../CHANGELOG.md for migration.
