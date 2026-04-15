# Service Control Skills

Skills for starting, stopping, restarting, and inspecting logs of the Nagi launchd service. These skills manage the macOS `launchd` agent (`com.nagi.{ASSISTANT_NAME}`) that keeps Nagi running in the background.

All four skills begin by detecting the available assistants under `deploy/` and prompting you to choose which one to operate on. If you have only one assistant deployed, the selection is automatic.

---

## `/nagi-start` — Start Service {#nagi-start}

Start the Nagi launchd service for a given assistant.

**Triggers:** `start`, `start nagi`

### What the skill does

1. Lists deployed assistants and asks which one to start.
2. Checks whether the service is **already running** via `launchctl list`. If it is, the skill tells you so and suggests using `/nagi-restart` instead.
3. Loads the plist with `launchctl load ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist`.
4. Verifies the service came up by checking that the PID is a number, the exit code is `0`, and the log contains `Orchestrator started`.
5. If startup fails, automatically inspects the error log at `__data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.error.log`.

### When to use

- After initial setup or after a machine reboot (if the plist is not set to `RunAtLoad`).
- When you have previously stopped the service with `/nagi-stop` and want to bring it back.

### Example

```
/nagi-start
# -> Which assistant do you want to start? [asana-agent]
# -> Loading com.nagi.asana-agent ...
# -> Service started successfully. Orchestrator started.
```

---

## `/nagi-stop` — Stop Service {#nagi-stop}

Stop the Nagi launchd service for a given assistant.

**Triggers:** `stop`, `stop nagi`

### What the skill does

1. Lists deployed assistants and asks which one to stop.
2. Unloads the plist with `launchctl unload ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist`.
3. Verifies the service is no longer listed in `launchctl list`.

### When to use

- Before making significant configuration changes that require a clean restart.
- When you want to temporarily disable the assistant without removing the deployment.
- For debugging: stop the service, then inspect logs at your own pace.

### Example

```
/nagi-stop
# -> Which assistant do you want to stop? [asana-agent]
# -> Unloading com.nagi.asana-agent ...
# -> Service stopped.
```

---

## `/nagi-restart` — Restart Service {#nagi-restart}

Restart the Nagi launchd service in place, without a separate stop/start cycle.

**Triggers:** `restart`, `restart nagi`

### What the skill does

1. Lists deployed assistants and asks which one to restart.
2. Performs an in-place restart using `launchctl kickstart -k`, which kills the running process and immediately relaunches it under the same job label.
3. Verifies the service is running again (PID is a number, exit code is `0`, logs show `Orchestrator started`).

### When to use

- **After any configuration change** -- updated environment variables, new plugins, changed group prompts, etc.
- After running `/deploy` or `/update-groups` to pick up the latest settings.
- When the service is in a bad state and you want a quick recovery without manually unloading and reloading the plist.

### Example

```
/nagi-restart
# -> Which assistant do you want to restart? [asana-agent]
# -> Restarting com.nagi.asana-agent ...
# -> Service restarted successfully. Orchestrator started.
```

> **Note:** `/nagi-restart` requires the service to already be loaded. If the service has been unloaded (via `/nagi-stop`), use `/nagi-start` instead.

---

## `/nagi-logs` — View Logs {#nagi-logs}

Display the latest Nagi service logs. Supports both standard output and error logs.

**Triggers:** `logs`, `show logs`, `nagi logs`, `check logs`

### What the skill does

1. Lists deployed assistants and asks which one to inspect.
2. Shows the last 50 lines of the standard log at `__data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log`.
3. Can also show the last 30 lines of the **error log** at `__data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.error.log` on request.
4. For real-time log streaming, provides a `tail -f` command you can run directly.

### Log file locations

| Log type | Path |
|---|---|
| Standard output | `__data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log` |
| Error output | `__data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.error.log` |

### When to use

- To verify the service started correctly after `/nagi-start` or `/nagi-restart`.
- To investigate unexpected behavior or errors.
- To monitor activity in real time while testing a new configuration.

### Example

```
/nagi-logs
# -> Which assistant's logs do you want to view? [asana-agent]
# -> (last 50 lines of nagi-asana-agent.log)
```

To follow logs in real time:

```
tail -f __data/asana-agent/logs/nagi-asana-agent.log
```
