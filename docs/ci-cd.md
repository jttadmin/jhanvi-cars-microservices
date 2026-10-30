# CI/CD with GitHub Actions

`.github/workflows/ci-cd.yml` builds, pushes and deploys Jhanvi Cars automatically.

| Event | What happens |
|---|---|
| Pull request to `main` | Builds the images of changed services (no push, no deploy) |
| Push / merge to `main` | Builds and pushes changed services to Docker Hub, then deploys them with Helm |
| **Run workflow** (manual) | Same as a push; choose `changed` or `all` services |

Each image is tagged `sha-<7-char commit>` and `latest`. Only services whose folder changed are rebuilt; the
other services keep the tag they are already running. Changes under `helm/` trigger a deploy on their own.

```
changes ──► build (one job per changed service, GitHub-hosted) ──► deploy (self-hosted runner on the cluster)
```

## One-time setup

### 1. Docker Hub token

Docker Hub → Account settings → Personal access tokens → **Generate** (Read & Write).

### 2. Repository secrets

GitHub → repo **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub username (e.g. `jhanviadmin`) |
| `DOCKERHUB_TOKEN` | The token from step 1 |
| `FRONTEND_ENV` | Full contents of `frontend/.env.local`, e.g. `VITE_GOOGLE_MAPS_API_KEY=...` |

### 3. Repository variables (optional)

**Variables** tab — only needed if the defaults don't match your setup:

| Variable | Default | Purpose |
|---|---|---|
| `DOCKERHUB_NAMESPACE` | `jhanviadmin` | Docker Hub org/user the images are pushed to |
| `HELM_RELEASE` | auto-detected | Name of your installed Helm release |
| `HELM_NAMESPACE` | auto-detected | Namespace where that release is stored |
| `K8S_NAMESPACE` | `jhanvi-cars` | Namespace the app runs in (`global.namespace`) |

The deploy job finds the release automatically by looking for a release of the `jhanvi-cars` chart
(`helm list -A`). Set the two `HELM_*` variables if you have more than one.

### 4. `production` environment

**Settings → Environments → New environment** → `production`. Optionally add yourself as a
**required reviewer** so every deploy waits for a click of approval.

### 5. Self-hosted runner on the cluster

Run this on the EC2 control-plane node (or any node that has `kubectl` access):

1. GitHub → **Settings → Actions → Runners → New self-hosted runner** → Linux x64. Follow the download and
   `./config.sh` commands shown there, and when asked for labels enter:

   ```
   jhanvi-k8s
   ```

2. Install it as a service so it survives reboots:

   ```bash
   sudo ./svc.sh install "$USER"
   sudo ./svc.sh start
   ```

3. Make sure the runner's user can reach the cluster and has Helm 3.14+:

   ```bash
   kubectl get nodes          # must work for this user (~/.kube/config)
   helm version --short       # v3.14 or newer recommended
   python3 --version          # used by the deploy job
   ```

   Helm install, if needed:
   `curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash`

The runner only makes outbound HTTPS connections to GitHub, so you do **not** need to expose the
Kubernetes API (port 6443) to the internet.

### 6. Protect the runner (important — the repo is public)

A self-hosted runner executes workflow code on your server. In this workflow the deploy job never runs on
pull requests, but also set:

- **Settings → Actions → General → Fork pull request workflows** → *Require approval for all external
  contributors*.
- **Settings → Branches** → protect `main` (require a pull request before merging).

## How a deploy works

1. Migration Jobs of the changed services are deleted (a Job's image can't be changed in place).
2. `helm upgrade --reset-then-reuse-values --set images.<service>.tag=sha-xxxxxxx …` applies the new tags and
   recreates those Jobs. `--atomic` rolls the release back automatically if the upgrade fails.
3. The workflow waits for each migration Job to complete (logs are printed on failure) and for each
   Deployment rollout to finish.

## Rolling back

```bash
helm history <release> -n <release-namespace>
helm rollback <release> <revision> -n <release-namespace>
```

Or revert the bad commit on `main`; the revert triggers a normal deploy.
