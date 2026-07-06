# Sklad Helm Chart

Helm chart for deploying [Sklad](https://github.com/vutratenko/sklad) — self-hosted WMS with Go API and PWA frontend.

## Prerequisites

- Kubernetes 1.24+
- Helm 3.8+ (OCI registry support)
- PostgreSQL (external; not included in this chart)
- Secret with `DATABASE_URL` and OIDC credentials

## Install from GHCR

```bash
# Create API secrets (recommended: manage outside Helm)
kubectl create secret generic sklad-api-secrets \
  --from-literal=DATABASE_URL='postgres://user:pass@postgres:5432/sklad?sslmode=disable' \
  --from-literal=OIDC_ISSUER_URL='https://nextcloud.example.com' \
  --from-literal=OIDC_CLIENT_ID='sklad' \
  --from-literal=OIDC_CLIENT_SECRET='...'

# Install chart
helm install sklad oci://ghcr.io/vutratenko/charts/sklad --version 0.1.6 \
  --set api.existingSecret=sklad-api-secrets \
  --set ingress.enabled=true \
  --set ingress.host=sklad.example.com
```

## Upgrade

```bash
helm upgrade sklad oci://ghcr.io/vutratenko/charts/sklad --version 0.1.6 \
  --reuse-values
```

Database migrations run automatically via a Helm pre-install/pre-upgrade Job (`/migrate`).

## Docker images

```bash
docker pull ghcr.io/vutratenko/sklad-api:0.1.6
docker pull ghcr.io/vutratenko/sklad-web:0.1.6
```

## Key values

| Value | Description | Default |
|-------|-------------|---------|
| `image.api.repository` | API image | `ghcr.io/vutratenko/sklad-api` |
| `image.web.repository` | Web image | `ghcr.io/vutratenko/sklad-web` |
| `api.existingSecret` | K8s Secret name for DB/OIDC | `sklad-api-secrets` |
| `migrate.enabled` | Run migration Job on install/upgrade | `true` |
| `ingress.enabled` | Create Ingress | `false` |
| `api.persistence.enabled` | PVC for media uploads | `true` |

See [values.yaml](values.yaml) for all options.

## Local development (chart from git)

```bash
helm template sklad ./infra/helm/sklad
helm install sklad ./infra/helm/sklad --dry-run
```

## Raw manifests

Legacy manifests in `infra/k8s/base/` are kept for reference. Prefer this Helm chart for production deployments.
