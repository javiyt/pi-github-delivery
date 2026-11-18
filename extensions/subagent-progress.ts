/** UI-only progress bridge for pi-agent-suite. No messages or context entries. */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, renameSync, readdirSync, readFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";

const KEY = "subagent-progress";
const POLL_MS = 600;
const WRITE_MS = 250;
const MAX_TEXT = 6000;
const MAX_FILE = 24000;
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

type Snapshot = {
  version: 1;
  pid: number;
  root: string;
  agent: string;
  session: string;
  model: string;
  status: "working" | "finished" | "error";
  activity: string;
  text: string;
  updatedAt: number;
};

export function channelDirectory(root: string): string {
  const hash = createHash("sha256").update(root).digest("hex").slice(0, 32);
  return join(tmpdir(), `pi-subagent-progress-${process.getuid?.() ?? "user"}-${hash}`);
}

/** Strip terminal control sequences; never include thinking blocks or tool arguments wholesale. */
export function visibleText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content.filter(p => p?.type === "text" && typeof p.text === "string")
    .map(p => p.text).join("\n").slice(-MAX_TEXT);
}

export function clean(value: string): string {
  return stripVTControlCharacters(value)
    .replace(/[\x00-\x08\x0b-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\r/g, "")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]")
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{16,})\b/g, "[redacted]")
    .slice(-MAX_TEXT);
}

function processAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
}

function readSnapshots(directory: string, root: string): Snapshot[] {
  try {
    return readdirSync(directory).filter(n => /^[a-f0-9]{32}\.json$/.test(n)).slice(0, 64)
      .flatMap(name => {
        try {
          const path = join(directory, name);
          if (statSync(path).size > MAX_FILE) return [];
          const s = JSON.parse(readFileSync(path, "utf8"));
          if (s.version !== 1 || s.root !== root || !Number.isSafeInteger(s.pid) || s.pid < 1 ||
              !["working", "finished", "error"].includes(s.status) ||
              ![s.agent, s.session, s.model, s.activity, s.text].every(v => typeof v === "string") ||
              !Number.isFinite(s.updatedAt) || Date.now() - s.updatedAt > MAX_AGE_MS) return [];
          if (s.status === "working" && !processAlive(s.pid)) {
            s.status = "error";
            s.activity = "Proceso finalizado sin recibo";
          }
          return [s as Snapshot];
        } catch { return []; }
      }).sort((a, b) => Number(b.status === "working") - Number(a.status === "working") || b.updatedAt - a.updatedAt);
  } catch { return []; }
}

export default function subagentProgress(pi: ExtensionAPI) {
  const rootId = process.env.PI_SUBAGENT_ROOT_SESSION_ID;
  const child = Number(process.env.PI_SUBAGENT_DEPTH ?? 0) > 0;
  if (child) {
    // Additional extensions load in children under agent-suite's default mode "all".
    if (!rootId) return;
    const directory = channelDirectory(rootId);
    let snapshot: Snapshot | undefined;
    let pending: ReturnType<typeof setTimeout> | undefined;
    let lastWrite = 0;
    let target = "";
    const flush = () => {
      if (pending) clearTimeout(pending);
      pending = undefined;
      if (!snapshot || !target) return;
      try {
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        const temporary = `${target}.${process.pid}.tmp`;
        writeFileSync(temporary, JSON.stringify(snapshot), { mode: 0o600 });
        renameSync(temporary, target);
        lastWrite = Date.now();
      } catch { /* Presentation must never interrupt delivery. */ }
    };
    const update = (changes: Partial<Snapshot>, ctx: ExtensionContext, immediate = false) => {
      if (!snapshot) return;
      snapshot = { ...snapshot, ...changes, updatedAt: Date.now(),
        model: ctx.model ? clean(`${ctx.model.provider}/${ctx.model.id}`).slice(0, 200) : snapshot.model };
      if (immediate || Date.now() - lastWrite >= WRITE_MS) flush();
      else if (!pending) {
        pending = setTimeout(flush, WRITE_MS);
        pending.unref();
      }
    };
    pi.on("session_start", (_event, ctx) => {
      const session = ctx.sessionManager.getSessionId();
      const id = createHash("sha256").update(session).digest("hex").slice(0, 32);
      target = join(directory, `${id}.json`);
      snapshot = { version: 1, pid: process.pid, root: rootId, session,
        agent: clean(process.env.PI_SUBAGENT_AGENT_ID ?? "Subagente").slice(0, 100), model: "",
        status: "working", activity: "Iniciando", text: "", updatedAt: Date.now() };
      update({}, ctx, true);
    });
    pi.on("agent_start", (_event, ctx) => update({ status: "working", activity: "Generando respuesta", text: "" }, ctx));
    pi.on("message_update", (event, ctx) => {
      const message = event.message as { role?: string };
      if (message.role !== "assistant") return;
      const text = clean(visibleText(message));
      if (text) update({ activity: "Respuesta", text }, ctx);
    });
    pi.on("message_end", (event, ctx) => {
      const message = event.message as { role?: string; stopReason?: string };
      if (message.role !== "assistant") return;
      const text = clean(visibleText(message));
      update({ ...(text ? { text } : {}),
        ...(message.stopReason === "error" || message.stopReason === "aborted"
          ? { status: "error" as const, activity: message.stopReason === "aborted" ? "Interrumpido" : "Error del modelo" } : {}) }, ctx);
    });
    pi.on("tool_execution_start", (event, ctx) => {
      const args = event.args as Record<string, unknown> | undefined;
      const detail = typeof args?.path === "string" ? args.path : "";
      update({ activity: clean(`${event.toolName}${detail ? ` · ${detail}` : ""}`).slice(0, 500), text: "" }, ctx, true);
    });
    pi.on("tool_execution_update", (event, ctx) => {
      const text = clean(visibleText(event.partialResult));
      if (text) update({ activity: clean(event.toolName).slice(0, 500), text }, ctx);
    });
    pi.on("tool_execution_end", (event, ctx) => {
      update({ activity: clean(`${event.isError ? "Error" : "Completado"} · ${event.toolName}`).slice(0, 500),
        text: clean(visibleText(event.result)) }, ctx, true);
    });
    const finish = (ctx: ExtensionContext) => update({
      status: snapshot?.status === "error" ? "error" : "finished",
      activity: snapshot?.status === "error" ? snapshot.activity : "Finalizado",
    }, ctx, true);
    pi.on("agent_end", (_event, ctx) => finish(ctx));
    pi.on("session_shutdown", (_event, ctx) => finish(ctx));
    return;
  }

  let timer: ReturnType<typeof setInterval> | undefined;
  let directory = "";
  let root = "";
  let enabled = true;
  let lastView = "";
  let clearedAt = 0;
  let ui: ExtensionContext["ui"] | undefined;
  const refresh = () => {
    if (!ui || !enabled || !directory) return;
    const snapshots = readSnapshots(directory, root).filter(s => s.updatedAt > clearedAt);
    const s = snapshots[0];
    if (!s) {
      if (lastView) ui.setWidget(KEY, undefined);
      lastView = "";
      return;
    }
    const active = snapshots.filter(v => v.status === "working").length;
    const icon = s.status === "working" ? "●" : s.status === "error" ? "✗" : "✓";
    const lines = [
      `${icon} ${clean(s.agent)} · ${clean(s.activity)}${active > 1 ? ` · ${active} activos` : ""}`,
      clean(s.model),
      ...clean(s.text).split("\n").filter(v => v.trim()).slice(-6),
      "/subagent-progress off · /subagents para el historial completo",
    ];
    const signature = JSON.stringify(lines);
    if (signature === lastView) return;
    lastView = signature;
    ui.setWidget(KEY, (_tui, theme) => ({
      render: (width: number) => lines.map((line, i) =>
        truncateToWidth(theme.fg(i === 0 ? "accent" : "dim", line), width)),
      invalidate() {},
    }));
  };
  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    ui = ctx.ui;
    root = ctx.sessionManager.getSessionId();
    directory = channelDirectory(root);
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, POLL_MS);
    timer.unref();
    refresh();
  });
  pi.registerCommand("subagent-progress", {
    description: "Panel visual de subagentes: on, off o clear; no añade contexto al modelo",
    handler: async (args, ctx) => {
      const option = args.trim().toLowerCase();
      if (!ctx.hasUI) return;
      if (option === "off") {
        enabled = false;
        lastView = "";
        ctx.ui.setWidget(KEY, undefined);
      } else if (option === "clear") {
        clearedAt = Date.now();
        lastView = "";
        ctx.ui.setWidget(KEY, undefined);
      } else if (option === "on" || option === "") {
        enabled = true;
        refresh();
      } else ctx.ui.notify("Uso: /subagent-progress [on|off|clear]", "info");
    },
  });
  pi.on("session_shutdown", () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    ui?.setWidget(KEY, undefined);
    ui = undefined;
    if (directory) {
      try { rmSync(directory, { recursive: true, force: true }); } catch { /* UI only. */ }
    }
  });
}
