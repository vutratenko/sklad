# Sklad Argo CD Bootstrap

`bootstrap.yaml` creates the `sklad-gitops` app-of-apps Application. It tracks this
directory on `main` and applies:

- `application.yaml` — prod instance in namespace `sklad` (`sklad.sion2k.ru`)
- `application-demo.yaml` — demo instance in namespace `sklad-demo` (`sklad-demo.sion2k.ru`)

Both Applications deploy the Sklad Helm chart from GHCR.

Release flow:

1. A `v*` tag starts the GitHub Actions release workflow.
2. The workflow runs tests, builds images, and publishes the OCI Helm chart.
3. After the chart is published, the workflow updates `targetRevision` in both
   `application.yaml` and `application-demo.yaml`, then pushes that GitOps commit to `main`.
4. Argo CD detects the Git change and auto-syncs both chart revisions.
