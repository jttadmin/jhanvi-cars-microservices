# CI/CD: GitHub Actions + Argo CD

Jhanvi Cars deploys with a GitOps flow. GitHub never connects to the cluster; Argo CD runs inside the
cluster and pulls from Git.

```
 push to main
     │
     ▼
 GitHub Actions (GitHub-hosted runners)
   1. detect which services changed
   2. build + push images → Docker Hub  jhanviadmin/jhanvi-cars-<service>:sha-<commit>
   3. commit new tags → helm/jhanvi-cars/values.yaml   ("deploy: … [skip ci]")
     │
     ▼
 Argo CD (in the cluster) sees the commit and syncs:
   wave 0  config, Postgres, Memcached, Services, Ingress
   wave 1  migration Jobs (re-created on every sync, must succeed)
   wave 2  app Deployments roll out
```

| Event | What happens |
|---|---|
| Pull request to `main` | Builds images of changed services (no push) |
| Push / merge to `main` | Builds + pushes changed services, commits their new tags |
| **Run workflow** (manual) | Same as a push; choose `changed` or `all` |
| Change to `helm/**` only | No build; Argo CD syncs the chart change directly |

Only services whose folder changed get a new image. The others keep the tag already in `values.yaml`.

---

## One-time setup

### 1. GitHub secrets

Repo **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | `jhanviadmin` |
| `DOCKERHUB_TOKEN` | Docker Hub personal access token (Read & Write) |
| `FRONTEND_ENV` | Contents of `frontend/.env.local` (e.g. `VITE_GOOGLE_MAPS_API_KEY=...`) |

App secrets (database URLs, Razorpay keys, …) stay in the `jhanvi-cars-secrets` Kubernetes Secret on the
cluster. Neither GitHub nor Argo CD touches it.

### 2. Let the workflow commit tags to `main`

The `release` job pushes a small commit to `main` using the built-in `GITHUB_TOKEN`.

- **Settings → Actions → General → Workflow permissions** → *Read and write permissions*.
- If `main` is protected, allow GitHub Actions to bypass the rule: in the branch protection rule or
  ruleset, add **github-actions** to the bypass list. Otherwise only the `release` job fails, and the
  images are still pushed.

### 3. Install Argo CD (on the master)

```bash
kubectl create namespace argocd
kubectl apply -n argocd --server-side --force-conflicts \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

kubectl -n argocd rollout status deploy/argocd-server --timeout=5m
```

Admin password and UI (via port-forward; nothing exposed publicly):

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d; echo
kubectl -n argocd port-forward svc/argocd-server 8080:443
# then open https://localhost:8080 through an SSH tunnel: ssh -L 8080:localhost:8080 ubuntu@<master>
```

Log in as `admin`, then change the password (User Info → Update password).

### 4. Hand the existing Helm release over to Argo CD

Your app was installed with `helm install`. Argo CD renders the same chart, so it takes over the same
resources in place, with no downtime and Postgres data untouched.

**a. Check for values that only exist on the cluster.** Argo CD uses `values.yaml` from Git only.

```bash
helm list -A                                      # note the release NAME and NAMESPACE
helm get values <release> -n <release-namespace>  # anything printed here is NOT in Git
```

If this prints anything other than `USER-SUPPLIED VALUES: null`, copy those values into
`helm/jhanvi-cars/values.yaml` and commit them before continuing.
If the release name isn't `jhanvi-cars`, change `releaseName` in `argocd/jhanvi-cars-app.yaml` to match.

**b. Remove the old migration Jobs** (they become Argo CD hooks):

```bash
kubectl get jobs -n jhanvi-cars
kubectl delete job -n jhanvi-cars auth-migration user-migration driver-migration booking-migration \
  vehicle-migration payment-migration notification-migration --ignore-not-found
```

**c. Create the Argo CD Application:**

```bash
kubectl apply -f https://raw.githubusercontent.com/jttadmin/jhanvi-cars-microservices/main/argocd/jhanvi-cars-app.yaml
kubectl -n argocd get application jhanvi-cars -w      # wait for Synced / Healthy
```

**d. Stop using `helm upgrade`** for this app from now on. Argo CD is the only thing that deploys. To drop
Helm's bookkeeping without touching any running resource:

```bash
kubectl delete secret -n <release-namespace> -l owner=helm,name=<release>
```

### 5. First deploy

**Actions → CI/CD → Run workflow → `all`**. This builds every service, pushes the `sha-…` images, commits
the tags, and Argo CD rolls them out.

---

## Day to day

- **Deploy:** merge to `main`. Watch it in the Argo CD UI or with `kubectl -n argocd get app jhanvi-cars`.
- **Roll back:** revert the `deploy: … [skip ci]` commit on `main` (`git revert <sha> && git push`).
  Argo CD syncs the previous tags within a few minutes. (Argo CD's own "Rollback" button needs
  auto-sync turned off, so reverting in Git is the normal way.)
- **Manual `kubectl edit` is reverted** by Argo CD (`selfHeal: true`). Change things in Git instead.
- **Prune** is off, so resources removed from the chart are not deleted automatically. Delete them
  by hand, or set `prune: true` in `argocd/jhanvi-cars-app.yaml` once you're comfortable.
