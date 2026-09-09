export async function reconcileSetup({
  start,
  stop,
  status,
  isReady,
  onEvent = () => {},
}) {
  await onEvent({ type: "start", attempt: 1 });
  let started = await start();
  let recovered = false;

  if (!commandSucceeded(started)) {
    const deterministicFailure = classifyStartFailure(started);
    await onEvent({ type: "start-failed", attempt: 1, reason: deterministicFailure?.reason });
    if (deterministicFailure) {
      return await complete(onEvent, deterministicFailure);
    }

    await onEvent({ type: "stop", reason: "start-failed" });
    await stop();
    await onEvent({ type: "start", attempt: 2 });
    started = await start();
    if (!commandSucceeded(started)) {
      const deterministicFailure = classifyStartFailure(started);
      await onEvent({ type: "start-failed", attempt: 2, reason: deterministicFailure?.reason });
      if (deterministicFailure) return await complete(onEvent, deterministicFailure);
      await onEvent({ type: "diagnostic-status" });
      await status();
      return await complete(onEvent, compactResult({
        status: "not-verified",
        reason: "start-failed-after-recovery",
        code: commandFailureCode(started),
      }));
    }
    recovered = true;
  }

  await onEvent({ type: "start-succeeded", recovered });
  await onEvent({ type: "status", recovered });
  const checked = await status();
  if (!commandSucceeded(checked)) {
    await onEvent({ type: "status-failed" });
    return await complete(onEvent, compactResult({
      status: "not-verified",
      reason: "status-failed",
      code: commandFailureCode(checked),
    }));
  }
  await onEvent({ type: "status-succeeded" });

  const ready = await isReady(checked);
  if (!ready) {
    return await complete(onEvent, {
      status: "unavailable",
      reason: "not-ready",
      recovered,
    });
  }

  return await complete(onEvent, {
    status: "enabled",
    reason: "ready",
    recovered,
  });
}

export function runtimeAuthorityFailureCode(result) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return output.match(/\b(BACKEND_(?:(?:CONNECTION_AUTHORITY|TOKEN_RECORD|SERVICE_STATE)_(?:ABSENT|INVALID|UNSUPPORTED)|SERVICE_STATE_CLEANUP_FAILED))\b/)?.[1];
}

export function lifecycleLockFailureCode(result) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return output.match(/\bBACKEND_LIFECYCLE_LOCK_TIMEOUT\b/)?.[0];
}

export function clientHookRuntimeActivationFailed(result) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return /client Hook runtime activation failed:/i.test(output);
}

export function startLifecycleReport(result) {
  try {
    const report = JSON.parse(result.stdout ?? "");
    if (report?.action !== "start" || typeof report.ok !== "boolean") return undefined;
    if (report.backend !== undefined && typeof report.backend?.ok !== "boolean") return undefined;
    return report;
  } catch {}
  return undefined;
}

export function failedLifecycleAdapters(report) {
  return ["codex", "claude", "dsh", "opencode", "codebuddy", "workbuddy", "trae"].flatMap((client) => {
    const adapter = report?.[`${client}Adapter`];
    return adapter?.ok === false ? [{ ...adapter, client }] : [];
  });
}

function classifyStartFailure(result) {
  if (clientHookRuntimeActivationFailed(result)) {
    return {
      status: "not-verified",
      reason: "hook-runtime-activation-failed",
    };
  }

  const lifecycleCode = lifecycleLockFailureCode(result);
  if (lifecycleCode) {
    return {
      status: "not-verified",
      reason: "lifecycle-lock-timeout",
      code: lifecycleCode,
    };
  }

  const authorityCode = runtimeAuthorityFailureCode(result);
  if (authorityCode) {
    return {
      status: "not-verified",
      reason: "runtime-authority-failed",
      code: authorityCode,
    };
  }

  const report = startLifecycleReport(result);
  // A failed integration can follow a successful Backend recovery. Do not
  // restart all selected clients again, or treat incomplete setup as ready.
  if (report?.ok === false && report.backend?.ok === true && report.backend.skipped !== true) {
    const adapters = failedLifecycleAdapters(report);
    if (adapters.length > 0) {
      return { status: "not-verified", reason: "adapter-setup-failed" };
    }
  }
  return undefined;
}

function commandSucceeded(result) {
  return result?.status === 0;
}

function commandFailureCode(result) {
  return result?.code ?? result?.error?.code ?? result?.status;
}

function compactResult(result) {
  if (result.code === undefined) {
    const { code: _code, ...withoutCode } = result;
    return withoutCode;
  }
  return result;
}

async function complete(onEvent, result) {
  await onEvent({ type: "complete", ...result });
  return result;
}
