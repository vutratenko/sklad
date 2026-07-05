# Deprecated: use Helm chart instead

These raw Kubernetes manifests are kept for reference only.

For production deployments use the Helm chart:

- Chart source: `infra/helm/sklad/`
- Published: `oci://ghcr.io/vutratenko/charts/sklad`
- See [infra/helm/sklad/README.md](../helm/sklad/README.md)

ArgoCD Application (`infra/argocd/application.yaml`) points to the OCI chart from GHCR.
