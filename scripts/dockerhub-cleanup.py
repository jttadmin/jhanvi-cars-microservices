#!/usr/bin/env python3
"""Delete old Jhanvi Cars image tags from Docker Hub, keeping what is deployed.

For every image referenced in helm/jhanvi-cars/values.yaml (apps + migrations),
this keeps:
  * the tag currently deployed (from values.yaml on main)
  * `latest`
  * the N most recent other tags (default 1), so a `git revert` rollback
    still finds its image
and deletes every other tag in that repository.

Dry run by default: nothing is deleted unless you pass --delete and then
type DELETE to confirm.

Usage (on any machine with Python 3.8+):
  export DOCKERHUB_USERNAME=jhanviadmin
  export DOCKERHUB_TOKEN=...            # personal access token: Read, Write, Delete
  python3 dockerhub-cleanup.py                      # dry run, shows the plan
  python3 dockerhub-cleanup.py --delete             # delete after confirmation
  python3 dockerhub-cleanup.py --keep-previous 0    # keep only the deployed tag (no rollback)
  python3 dockerhub-cleanup.py --values ./values.yaml

Only repositories listed in values.yaml are touched; postgres and any other
images are never modified.
"""
import argparse
import getpass
import json
import os
import re
import sys
import urllib.error
import urllib.request

DEFAULT_VALUES_URL = (
    "https://raw.githubusercontent.com/jttadmin/jhanvi-cars-microservices/main/"
    "helm/jhanvi-cars/values.yaml"
)
HUB = "https://hub.docker.com/v2"


def http(method, url, token=None, body=None):
    headers = {"Accept": "application/json"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else None


def deployed_images(values_text, namespace):
    """Return {repo_name: current_tag} for images under `namespace/` in values.yaml."""
    images = {}
    repo = None
    for line in values_text.splitlines():
        m = re.match(r"^\s*repository:\s*['\"]?([^'\"\s#]+)", line)
        if m:
            repo = m.group(1)
            continue
        m = re.match(r"^\s*tag:\s*['\"]?([^'\"\s#]+)", line)
        if m and repo:
            if repo.startswith(namespace + "/"):
                images[repo.split("/", 1)[1]] = m.group(1)
            repo = None
    return images


def list_tags(namespace, repo, token):
    tags, url = [], f"{HUB}/namespaces/{namespace}/repositories/{repo}/tags?page_size=100"
    while url:
        page = http("GET", url, token)
        tags.extend(page.get("results", []))
        url = page.get("next")
    # newest first
    return sorted(tags, key=lambda t: t.get("last_updated") or "", reverse=True)


def plan_repo(tags, current, keep_previous):
    names = [t["name"] for t in tags]
    keep = {current, "latest"}
    previous = [n for n in names if n not in keep][:keep_previous]
    keep.update(previous)
    delete = [n for n in names if n not in keep]
    return sorted(keep & set(names) | {current}), previous, delete


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--values", default=DEFAULT_VALUES_URL, help="values.yaml path or URL (default: main on GitHub)")
    ap.add_argument("--namespace", default=os.environ.get("DOCKERHUB_NAMESPACE", "jhanviadmin"))
    ap.add_argument("--keep-previous", type=int, default=1, help="extra recent tags to keep per repo for rollback (default 1)")
    ap.add_argument("--delete", action="store_true", help="actually delete (otherwise dry run)")
    args = ap.parse_args()

    if args.values.startswith("http"):
        values_text = urllib.request.urlopen(args.values, timeout=30).read().decode()
    else:
        values_text = open(args.values).read()
    images = deployed_images(values_text, args.namespace)
    if not images:
        sys.exit(f"No {args.namespace}/* images found in {args.values}")

    user = os.environ.get("DOCKERHUB_USERNAME") or input("Docker Hub username: ").strip()
    pat = os.environ.get("DOCKERHUB_TOKEN") or getpass.getpass("Docker Hub access token (Read, Write, Delete): ")
    try:
        token = http("POST", f"{HUB}/users/login", body={"username": user, "password": pat})["token"]
    except urllib.error.HTTPError as e:
        sys.exit(f"Docker Hub login failed (HTTP {e.code}). Check the username and token.")

    to_delete = []
    print(f"\n{'Repository':52} {'Deployed':22} Keep / delete")
    print("-" * 110)
    for repo, current in sorted(images.items()):
        try:
            tags = list_tags(args.namespace, repo, token)
        except urllib.error.HTTPError as e:
            print(f"{args.namespace + '/' + repo:52} {current:22} ! cannot list tags (HTTP {e.code}), skipped")
            continue
        names = [t["name"] for t in tags]
        if current not in names:
            print(f"{args.namespace + '/' + repo:52} {current:22} ! deployed tag NOT on Docker Hub, skipped for safety")
            continue
        keep, previous, delete = plan_repo(tags, current, args.keep_previous)
        print(f"{args.namespace + '/' + repo:52} {current:22} keep {len(keep)}, delete {len(delete)}"
              + (f"  (rollback: {', '.join(previous)})" if previous else ""))
        for name in delete:
            print(f"    - {name}")
        to_delete += [(repo, n) for n in delete]

    print("-" * 110)
    print(f"{len(to_delete)} tag(s) to delete across {len(images)} repositories.")
    if not to_delete:
        return
    if not args.delete:
        print("\nDry run only. Re-run with --delete to remove them.")
        return

    if input("\nType DELETE to permanently remove these tags: ").strip() != "DELETE":
        print("Cancelled; nothing deleted.")
        return

    failed = 0
    for repo, name in to_delete:
        try:
            http("DELETE", f"{HUB}/namespaces/{args.namespace}/repositories/{repo}/tags/{name}", token)
            print(f"deleted {args.namespace}/{repo}:{name}")
        except urllib.error.HTTPError as e:
            failed += 1
            print(f"FAILED  {args.namespace}/{repo}:{name} (HTTP {e.code})")
    print(f"\nDone: {len(to_delete) - failed} deleted, {failed} failed.")
    if failed:
        print("A 401/403 usually means the access token lacks the Delete permission.")


if __name__ == "__main__":
    main()
