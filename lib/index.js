import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";

/**
 * dsh-agent-manage —— 从 dsh-vscode-layout 抽离出的独立管理插件（host 半体）。
 * 原属 dsh-vscode-layout 项目，现独立存活：即使布局插件完全禁用/卸载，
 * 全局人设注入、MCP 动态管理、Skill 管理仍正常工作。
 *
 * 路由统一使用独立前缀 `/agent-manage`（与文件树的 `/vscode-files` 分开，
 * 避免将来布局恢复时 webServer 路由冲突）。
 */

const name = "dsh-agent-manage";
/** 依赖服务。 */
const inject = ["webServer"];

/** 单文件读取上限（persona / 请求体）。 */
const MAX_PERSONA_BYTES = 128 * 1024;
/** 全局人设文件（~/.dsh/global-persona.md，注入所有会话的 systemPrompt）。 */
const PERSONA_FILE = join(homedir(), ".dsh", "global-persona.md");
/** 全局人设的 prompt 段名与排序（紧随官方 persona order 0 之后）。 */
const PERSONA_SECTION = "user:global-persona";
const PERSONA_ORDER = 1;
/** MCP server 运行时管理（~/.dsh/mcp-servers.json，动态挂载 dsh-mcp-client）。 */
const MCP_STATE_FILE = join(homedir(), ".dsh", "mcp-servers.json");
/** 全局 skill 目录（~/.dsh/skills）。 */
const SKILLS_ROOT = join(homedir(), ".dsh", "skills");

function sendJson(res, code, value) {
	const body = JSON.stringify(value);
	res.writeHead(code, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(body);
}

/** 读取 JSON 请求体（带大小上限）。 */
function readJsonBody(req, cap) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > cap) {
				reject(new Error("request body too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			try {
				resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
			} catch {
				reject(new Error("invalid JSON body"));
			}
		});
		req.on("error", reject);
	});
}

/** 送回收站删除（可恢复；目录递归）。 */
function recycleBinDelete(target, isDir) {
	return new Promise((resolve, reject) => {
		const script = isDir
			? 'Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($env:DSH_DELETE_PATH, "OnlyErrorDialogs", "SendToRecycleBin")'
			: 'Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($env:DSH_DELETE_PATH, "OnlyErrorDialogs", "SendToRecycleBin")';
		execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
			env: { ...process.env, DSH_DELETE_PATH: target },
			timeout: 60000,
			windowsHide: true
		}, (error) => {
			if (error) reject(new Error(`recycle-bin delete failed: ${error.message}`));
			else resolve();
		});
	});
}

/** 名称合法性：单段、非空、不含路径分隔符。 */
function validSegment(s) {
	return typeof s === "string" && s.length > 0 && s.length <= 120 && !/[\\/]/.test(s) && s !== "." && s !== "..";
}

/** 从全局 dsh 安装解析任意包入口（兼容 ESM）。 */
function resolveDshModule(name) {
	try {
		return createRequire(import.meta.url).resolve(name);
	} catch {}
	const globalRoot = process.env.APPDATA ? join(process.env.APPDATA, "npm", "node_modules") : null;
	if (globalRoot) {
		const dshBin = join(globalRoot, "@deepseek-ai", "dsh", "lib", "bin.js");
		if (existsSync(dshBin)) {
			try {
				return createRequire(dshBin).resolve(name);
			} catch {}
		}
	}
	throw new Error(`无法定位 ${name}：请确认全局安装了 @deepseek-ai/dsh`);
}

// ── MCP server 运行时管理（动态挂载/卸载 dsh-mcp-client 实例，即时生效）──
let rootCtx = null;
let mcpClientModulePromise = null;
let mcpServers = [];
let mcpDisposers = new Map(); // id → disposer
function loadMCPClientModule() {
	if (mcpClientModulePromise === null) {
		mcpClientModulePromise = (async () => {
			const entry = resolveDshModule("@deepseek-ai/dsh-mcp-client");
			return import(pathToFileURL(entry).href);
		})();
	}
	return mcpClientModulePromise;
}
async function loadMCPState() {
	try {
		const raw = JSON.parse(await readFile(MCP_STATE_FILE, "utf8"));
		mcpServers = Array.isArray(raw?.servers) ? raw.servers : [];
	} catch {
		mcpServers = [];
	}
}
async function saveMCPState() {
	await mkdir(dirname(MCP_STATE_FILE), { recursive: true });
	await writeFile(MCP_STATE_FILE, JSON.stringify({ version: 1, servers: mcpServers }, null, 2), "utf8");
}
function mcpConfigOf(server) {
	const base = {
		serverName: server.serverName,
		toolCallTimeoutMs: server.toolCallTimeoutMs ?? 30000,
		failOnStartupError: false,
		reconnect: { enabled: false }
	};
	if (server.transport === "streamable-http") {
		return { ...base, transport: "streamable-http", url: server.url, headers: server.headers ?? {} };
	}
	return { ...base, transport: "stdio", command: server.command, args: server.args ?? [], env: server.env ?? {}, cwd: server.cwd ?? "" };
}
async function mountMCPServer(server) {
	try {
		const mod = await loadMCPClientModule();
		if (rootCtx === null) throw new Error("host plugin 尚未初始化");
		const dispose = await rootCtx.plugin(mod, mcpConfigOf(server));
		mcpDisposers.set(server.id, dispose);
	} catch (error) {
		console.error(`[dsh-agent-manage] MCP 挂载失败 ${server.serverName}:`, error instanceof Error ? error.message : String(error));
	}
}
async function unmountMCP(id) {
	const dispose = mcpDisposers.get(id);
	if (dispose !== void 0) {
		mcpDisposers.delete(id);
		try {
			await dispose();
		} catch {}
	}
}
function mcpPublicView(server) {
	return {
		id: server.id,
		serverName: server.serverName,
		transport: server.transport,
		command: server.command,
		args: server.args,
		url: server.url,
		enabled: server.enabled !== false,
		hasEnv: !!(server.env && Object.keys(server.env).length > 0)
	};
}

// ── Skill 管理（~/.dsh/skills；开关 = SKILL.md ↔ SKILL.md.disabled 改名，删除走回收站）──
async function listSkills() {
	const out = [];
	let entries = [];
	try {
		entries = await readdir(SKILLS_ROOT, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		const full = join(SKILLS_ROOT, entry.name);
		if (entry.isDirectory()) {
			if (existsSync(join(full, "SKILL.md"))) out.push({ name: entry.name, path: full, enabled: true, kind: "dir" });
			else if (existsSync(join(full, "SKILL.md.disabled"))) out.push({ name: entry.name, path: full, enabled: false, kind: "dir" });
		} else if (entry.isFile()) {
			if (entry.name.endsWith(".md")) out.push({ name: entry.name, path: full, enabled: true, kind: "file" });
			else if (entry.name.endsWith(".md.disabled")) out.push({ name: entry.name.slice(0, -".disabled".length), path: full, enabled: false, kind: "file" });
		}
	}
	out.sort((a, b) => a.name.localeCompare(b.name));
	return out;
}
async function toggleSkill(target) {
	const info = await stat(target);
	if (info.isDirectory()) {
		const on = join(target, "SKILL.md");
		const off = join(target, "SKILL.md.disabled");
		if (existsSync(on)) await rename(on, off);
		else if (existsSync(off)) await rename(off, on);
	} else {
		if (target.endsWith(".disabled")) await rename(target, target.slice(0, -".disabled".length));
		else await rename(target, target + ".disabled");
	}
}

/**
 * 独立管理接口（全局人设 / Skill / MCP）。
 * GET  /agent-manage/persona → { ok, content }
 * POST /agent-manage/persona body { content } → { ok }
 * GET  /agent-manage/skills → { ok, skills }
 * POST /agent-manage/skills/toggle body { path } → { ok }
 * POST /agent-manage/skills/delete body { path } → { ok }
 * GET  /agent-manage/mcp → { ok, servers }
 * POST /agent-manage/mcp/toggle body { id } → { ok, enabled }
 * POST /agent-manage/mcp/delete body { id } → { ok }
 * POST /agent-manage/mcp/add body { serverName, transport, command, args, url, env, headers } → { ok, id }
 */
function apply(ctx) {
	// 全局人设：注入所有会话的 systemPrompt（text 为函数，每次组装时读文件，改后即时生效）
	ctx.inject(["systemPrompt"], (promptCtx) => {
		promptCtx.systemPrompt.section({
			name: PERSONA_SECTION,
			order: PERSONA_ORDER,
			text: () => {
				try {
					return readFileSync(PERSONA_FILE, "utf8").slice(0, MAX_PERSONA_BYTES);
				} catch {
					return "";
				}
			}
		});
	});
	rootCtx = ctx;
	// MCP 运行时管理：启动时挂载 enabled 的 server，卸载时全部释放
	ctx.effect(() => {
		(async () => {
			await loadMCPState();
			for (const server of mcpServers) {
				if (server.enabled !== false) await mountMCPServer(server);
			}
		})();
		return () => {
			for (const id of [...mcpDisposers.keys()]) {
				const dispose = mcpDisposers.get(id);
				mcpDisposers.delete(id);
				try {
					dispose?.();
				} catch {}
			}
		};
	}, "dsh-agent-manage: mcp runtime");
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/agent-manage",
		handler: async (req, res) => {
			const url = new URL(req.url ?? "/", "http://x");
			// ── 全局人设 ──
			if (url.pathname === "/agent-manage/persona") {
				if (req.method === "POST") {
					try {
						const body = await readJsonBody(req, MAX_PERSONA_BYTES + 4096);
						const content = body?.content;
						if (typeof content !== "string") return sendJson(res, 400, { ok: false, error: "body needs { content: string }" });
						if (Buffer.byteLength(content, "utf8") > MAX_PERSONA_BYTES) return sendJson(res, 400, { ok: false, error: "persona too large" });
						await writeFile(PERSONA_FILE, content, "utf8");
						return sendJson(res, 200, { ok: true });
					} catch (error) {
						return sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
					}
				}
				let content = "";
				try {
					content = await readFile(PERSONA_FILE, "utf8");
				} catch {}
				return sendJson(res, 200, { ok: true, content });
			}
			// ── Skill / MCP 管理 ──
			if (url.pathname === "/agent-manage/skills" && req.method === "GET") {
				return sendJson(res, 200, { ok: true, skills: await listSkills() });
			}
			if (url.pathname === "/agent-manage/mcp" && req.method === "GET") {
				return sendJson(res, 200, { ok: true, servers: mcpServers.map(mcpPublicView) });
			}
			if (url.pathname === "/agent-manage/skills/toggle" || url.pathname === "/agent-manage/skills/delete"
				|| url.pathname === "/agent-manage/mcp/toggle" || url.pathname === "/agent-manage/mcp/delete"
				|| url.pathname === "/agent-manage/mcp/add") {
				if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method not allowed" });
				try {
					const body = await readJsonBody(req, 64 * 1024);
					if (url.pathname === "/agent-manage/skills/toggle") {
						const target = body?.path;
						if (typeof target !== "string" || target.length === 0) return sendJson(res, 400, { ok: false, error: "body needs { path }" });
						await toggleSkill(target);
						return sendJson(res, 200, { ok: true });
					}
					if (url.pathname === "/agent-manage/skills/delete") {
						const target = body?.path;
						if (typeof target !== "string" || target.length === 0) return sendJson(res, 400, { ok: false, error: "body needs { path }" });
						const info = await stat(target);
						await recycleBinDelete(target, info.isDirectory());
						return sendJson(res, 200, { ok: true });
					}
					if (url.pathname === "/agent-manage/mcp/toggle") {
						const server = mcpServers.find((s) => s.id === body?.id);
						if (server === void 0) return sendJson(res, 404, { ok: false, error: "server not found" });
						server.enabled = !(server.enabled !== false);
						if (server.enabled) await mountMCPServer(server);
						else await unmountMCP(server.id);
						await saveMCPState();
						return sendJson(res, 200, { ok: true, enabled: server.enabled });
					}
					if (url.pathname === "/agent-manage/mcp/delete") {
						await unmountMCP(body?.id);
						mcpServers = mcpServers.filter((s) => s.id !== body?.id);
						await saveMCPState();
						return sendJson(res, 200, { ok: true });
					}
					if (url.pathname === "/agent-manage/mcp/add") {
						const serverName = body?.serverName;
						const transport = body?.transport === "streamable-http" ? "streamable-http" : "stdio";
						if (typeof serverName !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(serverName)) {
							return sendJson(res, 400, { ok: false, error: "serverName 需为 1-32 位字母/数字/_-" });
						}
						if (mcpServers.some((s) => s.id === serverName)) return sendJson(res, 400, { ok: false, error: "serverName 已存在" });
						if (transport === "stdio") {
							if (typeof body?.command !== "string" || body.command.length === 0) return sendJson(res, 400, { ok: false, error: "stdio 类型需要 command" });
						} else if (typeof body?.url !== "string" || body.url.length === 0) {
							return sendJson(res, 400, { ok: false, error: "streamable-http 类型需要 url" });
						}
						const server = {
							id: serverName,
							serverName,
							transport,
							command: body?.command ?? "",
							args: Array.isArray(body?.args) ? body.args.map(String) : [],
							env: body?.env && typeof body.env === "object" ? Object.fromEntries(Object.entries(body.env).map(([k, v]) => [k, String(v)])) : {},
							url: body?.url ?? "",
							headers: body?.headers && typeof body.headers === "object" ? Object.fromEntries(Object.entries(body.headers).map(([k, v]) => [k, String(v)])) : {},
							enabled: true
						};
						mcpServers.push(server);
						await mountMCPServer(server);
						await saveMCPState();
						return sendJson(res, 200, { ok: true, id: serverName });
					}
				} catch (error) {
					return sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
				}
			}
			return sendJson(res, 404, { ok: false, error: "unknown agent-manage endpoint" });
		}
	}), "dsh-agent-manage: /agent-manage routes");
}

export { name, inject, apply };
