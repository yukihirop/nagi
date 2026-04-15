# Miscellaneous Skills

## `/add-context-probe` — Context Probe {#add-context-probe}

Install a probe under `deploy/{ASSISTANT_NAME}/container/context/` to verify that the auto-mount mechanism into containers is working correctly.

**Triggers:** `add context probe`, `context probe`, `probe context`, `verify context mount`, `test context mount`

### What is context mounting?

Nagi can automatically mount host directories into agent containers so that files on the host are visible to the agent at runtime. Specifically, every subdirectory found under `deploy/{ASSISTANT_NAME}/container/context/` is mounted read-only into the container at `/workspace/extra/{name}`. The agent's `additionalDirectories` setting picks these paths up, and any `CLAUDE.md` files inside them are appended to the agent's context through the `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` mechanism.

This is useful for injecting reference material, shared documentation, or project repositories into the agent without baking them into the Docker image.

### Why probes are useful

Because the mount chain involves several moving parts (host directory scan, Docker bind mount, `additionalDirectories` registration, and `CLAUDE.md` auto-append), failures can be silent. A probe gives you a quick, deterministic way to confirm each link in the chain:

- **Read path** — Can the agent read a known file at the expected container path?
- **additionalDirectories path** — Does the agent see the mounted directory as an additional directory?
- **CLAUDE.md auto-append path** — Does a `CLAUDE.md` placed in the probe directory get injected into the agent's context?

If any of these checks fail, you know exactly which layer to investigate.

### Supported probes

| Probe | Description | Best for |
|-------|-------------|----------|
| **Marker** | Creates a minimal `probe/` directory containing a `CLAUDE.md` and a `probe-marker.txt` marker file. | Quick smoke test of all three mount paths (lightweight, no network). |
| **Git clone** | Clones a real repository into `context/{name}/`. | Verifying mount behavior with a real-world directory structure. If the cloned repo contains a `CLAUDE.md`, the auto-append path is also tested. |

### Usage examples

**Install a marker probe:**

```
> /add-context-probe
# Select "install" → "marker"
# Restart the service with /nagi-restart
# Then ask the agent in chat:
#   "Read /workspace/extra/probe/probe-marker.txt and tell me the contents"
#   → Expected answer: "probe-marker-ok"
```

**Install a clone probe (e.g. a shared docs repo):**

```
> /add-context-probe
# Select "install" → "clone"
# Provide the repo URL, directory name, and clone depth
# Restart with /nagi-restart
# Then ask the agent:
#   "Read /workspace/extra/{name}/README.md and summarize it"
```

**Remove a probe when you are done:**

```
> /add-context-probe
# Select "remove" → pick the probe directory to delete
# Restart with /nagi-restart
```

### Verifying in the logs

After restarting the service, run `/nagi-logs` and look for:

- `Container mount configuration` containing `.../context/{name} -> /workspace/extra/{name} (ro)` — confirms the host-side mount succeeded.
- `[agent-runner] Additional directories: ... /workspace/extra/{name}` — confirms the agent recognized the directory.

### Notes

- Probe files land under `deploy/*/`, which is excluded by `.gitignore`, so they will never be committed to the repository.
- The probe remains harmless if left in place, but removing it when no longer needed keeps the mount list clean.
- The skill also supports a **status** action that lists everything currently under `context/` without making changes.
