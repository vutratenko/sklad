# Sklad Argo CD Bootstrap

`bootstrap.yaml` creates the `sklad-gitops` app-of-apps Application. It tracks this
directory on `main` and applies `application.yaml`, which deploys the Sklad Helm
chart from GHCR.

Release flow:

1. A `v*` tag starts the GitHub Actions release workflow.
2. The workflow runs tests, builds images, and publishes the OCI Helm chart.
3. After the chart is published, the workflow updates `application.yaml`
   `targetRevision` and pushes that GitOps commit to `main`.
4. Argo CD detects the Git change and auto-syncs the chart revision.
