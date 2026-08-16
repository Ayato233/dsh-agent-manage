window.__ModuleLoader__.load({
	id: "@ayato233/dsh-agent-manage",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		const h = react.createElement;

		// ── 管理分区样式（原属 dsh-client-vscode-layout，随三分区一并抽离）──
		const css = [
			// 设置面板 · 全局人设分区
			".vk_personaSection{display:flex;flex-direction:column;gap:10px;padding:16px;width:100%;box-sizing:border-box;--vk-accent:var(--dsw-alias-accent,var(--dsw-alias-state-business-primary))}",
			".vk_personaDesc{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.7}",
			".vk_personaArea{min-height:280px;resize:vertical;background:var(--dsw-specific-input-fill,var(--dsw-specific-sidebar-fill));color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 12px;font-family:inherit;font-size:12.5px;line-height:1.75;tab-size:4}",
			".vk_personaArea:focus{outline:none;border-color:var(--vk-accent)}",
			".vk_personaFoot{display:flex;align-items:center;gap:8px}",
			".vk_personaMsg{font-size:12px}",
			".vk_personaMsgOk{color:#73c991}",
			".vk_personaMsgErr{color:#f14c4c}",
			".vk_personaSave{background:var(--vk-accent);color:#fff;border-radius:6px;padding:6px 16px;font-weight:600;border:none;cursor:pointer;font-size:12.5px}",
			".vk_personaSave:hover{filter:brightness(1.1)}",
			".vk_personaSave:disabled{opacity:.5;cursor:default}",
			// Skill / MCP 管理
			".vk_mgrList{display:flex;flex-direction:column;gap:8px}",
			".vk_mgrRow{display:flex;align-items:center;gap:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 12px;background:var(--dsw-specific-input-fill,var(--dsw-specific-sidebar-fill))}",
			".vk_mgrInfo{flex:1;min-width:0}",
			".vk_mgrName{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".vk_mgrMeta{font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}",
			".vk_mgrBadge{flex:none;font-size:11px;border-radius:999px;padding:2px 9px;font-weight:600}",
			".vk_mgrBadgeOn{color:#73c991;background:rgba(115,201,145,.14)}",
			".vk_mgrBadgeOff{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}",
			".vk_mgrBtn{flex:none;appearance:none;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;font-family:inherit}",
			".vk_mgrBtn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}",
			".vk_mgrBtn:disabled{opacity:.5;cursor:default}",
			".vk_mgrBtnDanger{color:#f14c4c;border-color:rgba(241,76,76,.35)}",
			".vk_mgrBtnDanger:hover{background:rgba(241,76,76,.1);color:#f14c4c}",
			".vk_mgrBtnPrimary{background:var(--vk-accent);color:#fff;border-color:transparent;font-weight:600}",
			".vk_mgrBtnPrimary:hover{filter:brightness(1.1);color:#fff}",
			".vk_mgrHead{display:flex;align-items:center;gap:8px;margin-bottom:10px}",
			".vk_mgrEmpty{font-size:12px;color:var(--dsw-alias-label-secondary);padding:18px 0;text-align:center}",
			".vk_mgrAddForm{display:flex;flex-direction:column;gap:8px;border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;padding:12px;margin-bottom:10px}",
			".vk_mgrInput{background:var(--dsw-specific-input-fill,var(--dsw-specific-sidebar-fill));color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:6px 10px;font-size:12.5px;font-family:inherit}",
			".vk_mgrInput:focus{outline:none;border-color:var(--vk-accent)}",
			".vk_mgrLabel{font-size:11.5px;color:var(--dsw-alias-label-secondary)}"
		].join("");
		{
			const tagId = "@ayato233/dsh-agent-manage/manage.module.css";
			if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
				const tag = document.createElement("style");
				tag.dataset.plugin = "@ayato233/dsh-agent-manage";
				tag.dataset.pluginCss = tagId;
				tag.textContent = css;
				document.head.appendChild(tag);
			}
		}

		// ── 组件：全局人设设置分区（settings.section，类似 CC 的全局 CLAUDE.md）──
		function PersonaSection() {
			const [content, setContent] = react.useState(null); // null = 加载中
			const [saving, setSaving] = react.useState(false);
			const [msg, setMsg] = react.useState(null); // {ok, text}
			react.useEffect(() => {
				let dead = false;
				fetch("/agent-manage/persona")
					.then((r) => r.json())
					.then((d) => { if (!dead) setContent(d && d.ok ? (d.content || "") : ""); })
					.catch(() => { if (!dead) setContent(""); });
				return () => { dead = true; };
			}, []);
			const save = () => {
				setSaving(true);
				setMsg(null);
				fetch("/agent-manage/persona", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content }) })
					.then((r) => r.json())
					.then((d) => { setSaving(false); setMsg(d && d.ok ? { ok: true, text: "已保存 ✓ 新消息立即生效" } : { ok: false, text: (d && d.error) || "保存失败" }); })
					.catch((e) => { setSaving(false); setMsg({ ok: false, text: String(e) }); });
			};
			return h("div", { className: "vk_personaSection" },
				h("div", { className: "vk_personaDesc" }, "类似 Claude Code 的全局 CLAUDE.md：内容会注入到所有会话的系统提示中，新消息立即生效（无需重启）。支持 Markdown。"),
				content === null
					? h("div", { className: "vk_personaDesc" }, "加载中…")
					: h("textarea", { className: "vk_personaArea", value: content, onChange: (e) => setContent(e.target.value), placeholder: "例如：\n- 你叫小鲸，说话简洁直接\n- 一律用简体中文回答\n- …" }),
				h("div", { className: "vk_personaFoot" },
					msg !== null ? h("div", { className: "vk_personaMsg" + (msg.ok ? " vk_personaMsgOk" : " vk_personaMsgErr") }, msg.text) : null,
					h("div", { style: { flex: 1 } }),
					h("button", { className: "vk_personaSave", disabled: saving || content === null, onClick: save }, saving ? "保存中…" : "保存")
				)
			);
		}

		// ── 组件：技能管理分区（~/.dsh/skills，开关/删除）──
		function SkillSection() {
			const [skills, setSkills] = react.useState(null);
			const [busy, setBusy] = react.useState(false);
			const [err, setErr] = react.useState(null);
			const refresh = react.useCallback(() => {
				let dead = false;
				setBusy(true);
				fetch("/agent-manage/skills")
					.then((r) => r.json())
					.then((d) => { if (!dead) { setSkills(d && d.ok ? d.skills : []); setErr(null); } })
					.catch((e) => { if (!dead) setErr(String(e)); })
					.finally(() => { if (!dead) setBusy(false); });
				return () => { dead = true; };
			}, []);
			react.useEffect(refresh, [refresh]);
			const act = (path, kind) => {
				setBusy(true);
				setErr(null);
				fetch("/agent-manage/skills/" + kind, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }) })
					.then((r) => r.json())
					.then((d) => { if (!d || !d.ok) setErr((d && d.error) || "操作失败"); refresh(); })
					.catch((e) => { setErr(String(e)); setBusy(false); });
			};
			return h("div", { className: "vk_personaSection" },
				h("div", { className: "vk_mgrHead" },
					h("div", { className: "vk_personaDesc", style: { flex: 1 } }, "管理 ~/.dsh/skills 下的全局 Skill（目录含 SKILL.md，或单文件 .md）。关闭 = 标记 .disabled，不删除内容。"),
					h("button", { className: "vk_mgrBtn", onClick: refresh, disabled: busy }, "刷新")
				),
				err !== null ? h("div", { className: "vk_personaMsg vk_personaMsgErr" }, String(err)) : null,
				skills === null ? h("div", { className: "vk_mgrEmpty" }, "加载中…")
					: skills.length === 0 ? h("div", { className: "vk_mgrEmpty" }, "暂无全局 Skill（~/.dsh/skills 为空）")
					: h("div", { className: "vk_mgrList" },
						skills.map((s) => h("div", { key: s.path, className: "vk_mgrRow" },
							h("div", { className: "vk_mgrInfo" },
								h("div", { className: "vk_mgrName" }, s.name),
								h("div", { className: "vk_mgrMeta" }, (s.kind === "dir" ? "目录" : "单文件") + " · " + s.path)
							),
							h("span", { className: "vk_mgrBadge " + (s.enabled ? "vk_mgrBadgeOn" : "vk_mgrBadgeOff") }, s.enabled ? "开启" : "关闭"),
							h("button", { className: "vk_mgrBtn", disabled: busy, onClick: () => act(s.path, "toggle") }, s.enabled ? "关闭" : "开启"),
							h("button", { className: "vk_mgrBtn vk_mgrBtnDanger", disabled: busy, onClick: () => { if (window.confirm("确定删除 Skill「" + s.name + "」？（送回收站，可恢复）")) act(s.path, "delete"); } }, "删除")
						))
					)
			);
		}

		// ── 组件：MCP 管理分区（~/.dsh/mcp-servers.json，开关/删除/添加）──
		function MCPSection() {
			const [servers, setServers] = react.useState(null);
			const [busy, setBusy] = react.useState(false);
			const [err, setErr] = react.useState(null);
			const [showAdd, setShowAdd] = react.useState(false);
			const [form, setForm] = react.useState({ serverName: "", transport: "stdio", command: "", args: "", url: "", env: "{}" });
			const refresh = react.useCallback(() => {
				let dead = false;
				setBusy(true);
				fetch("/agent-manage/mcp")
					.then((r) => r.json())
					.then((d) => { if (!dead) { setServers(d && d.ok ? d.servers : []); setErr(null); } })
					.catch((e) => { if (!dead) setErr(String(e)); })
					.finally(() => { if (!dead) setBusy(false); });
				return () => { dead = true; };
			}, []);
			react.useEffect(refresh, [refresh]);
			const act = (id, kind) => {
				setBusy(true);
				setErr(null);
				fetch("/agent-manage/mcp/" + kind, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) })
					.then((r) => r.json())
					.then((d) => { if (!d || !d.ok) setErr((d && d.error) || "操作失败"); refresh(); })
					.catch((e) => { setErr(String(e)); setBusy(false); });
			};
			const submitAdd = () => {
				let env = {};
				try {
					env = JSON.parse(form.env || "{}");
					if (typeof env !== "object" || env === null || Array.isArray(env)) throw new Error("not object");
				} catch {
					setErr("环境变量需为 JSON 对象，如 {\"KEY\":\"value\"}");
					return;
				}
				setBusy(true);
				setErr(null);
				fetch("/agent-manage/mcp/add", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
					serverName: form.serverName.trim(),
					transport: form.transport,
					command: form.command.trim(),
					args: form.args.split(/[\s,]+/).filter(Boolean),
					url: form.url.trim(),
					env
				}) })
					.then((r) => r.json())
					.then((d) => {
						setBusy(false);
						if (!d || !d.ok) setErr((d && d.error) || "添加失败");
						else {
							setShowAdd(false);
							setForm({ serverName: "", transport: "stdio", command: "", args: "", url: "", env: "{}" });
							refresh();
						}
					})
					.catch((e) => { setBusy(false); setErr(String(e)); });
			};
			return h("div", { className: "vk_personaSection" },
				h("div", { className: "vk_mgrHead" },
					h("div", { className: "vk_personaDesc", style: { flex: 1 } }, "管理 MCP server（~/.dsh/mcp-servers.json，含密钥，请勿外传）。开关即时生效，无需重启。"),
					h("button", { className: "vk_mgrBtn", onClick: () => setShowAdd(!showAdd) }, showAdd ? "取消添加" : "＋ 添加 MCP"),
					h("button", { className: "vk_mgrBtn", onClick: refresh, disabled: busy }, "刷新")
				),
				err !== null ? h("div", { className: "vk_personaMsg vk_personaMsgErr" }, String(err)) : null,
				showAdd ? h("div", { className: "vk_mgrAddForm" },
					h("div", { className: "vk_mgrLabel" }, "serverName（唯一标识，1-32 位字母/数字/_-）"),
					h("input", { className: "vk_mgrInput", value: form.serverName, onChange: (e) => setForm({ ...form, serverName: e.target.value }), placeholder: "my-server" }),
					h("div", { className: "vk_mgrLabel" }, "传输类型"),
					h("select", { className: "vk_mgrInput", value: form.transport, onChange: (e) => setForm({ ...form, transport: e.target.value }) },
						h("option", { value: "stdio" }, "stdio（本地进程）"),
						h("option", { value: "streamable-http" }, "streamable-http（远程 URL）")
					),
					form.transport === "stdio"
						? h("div", { className: "vk_mgrLabel" }, "命令（参数用空格/逗号分隔）")
						: h("div", { className: "vk_mgrLabel" }, "URL"),
					form.transport === "stdio"
						? h("input", { className: "vk_mgrInput", value: form.command, onChange: (e) => setForm({ ...form, command: e.target.value }), placeholder: "npx @playwright/mcp@latest --browser msedge" })
						: h("input", { className: "vk_mgrInput", value: form.url, onChange: (e) => setForm({ ...form, url: e.target.value }), placeholder: "https://example.com/mcp" }),
					form.transport === "stdio"
						? h("div", { className: "vk_mgrLabel" }, "环境变量（JSON 对象，可含密钥）")
						: h("div", { className: "vk_mgrLabel" }, "请求头（JSON 对象，可含密钥）"),
					h("input", { className: "vk_mgrInput", value: form.env, onChange: (e) => setForm({ ...form, env: e.target.value }), placeholder: '{"KEY":"value"}' }),
					h("div", { className: "vk_personaFoot" },
						h("button", { className: "vk_mgrBtn", onClick: () => setShowAdd(false) }, "取消"),
						h("div", { style: { flex: 1 } }),
						h("button", { className: "vk_mgrBtn vk_mgrBtnPrimary", disabled: busy, onClick: submitAdd }, "添加并启用")
					)
				) : null,
				servers === null ? h("div", { className: "vk_mgrEmpty" }, "加载中…")
					: servers.length === 0 ? h("div", { className: "vk_mgrEmpty" }, "暂无 MCP server，点「＋ 添加 MCP」添加")
					: h("div", { className: "vk_mgrList" },
						servers.map((s) => h("div", { key: s.id, className: "vk_mgrRow" },
							h("div", { className: "vk_mgrInfo" },
								h("div", { className: "vk_mgrName" }, s.serverName),
								h("div", { className: "vk_mgrMeta" }, (s.transport === "stdio" ? (s.command || "stdio") : (s.url || "http")) + (s.hasEnv ? " · 含环境变量" : ""))
							),
							h("span", { className: "vk_mgrBadge " + (s.enabled ? "vk_mgrBadgeOn" : "vk_mgrBadgeOff") }, s.enabled ? "开启" : "关闭"),
							h("button", { className: "vk_mgrBtn", disabled: busy, onClick: () => act(s.id, "toggle") }, s.enabled ? "关闭" : "开启"),
							h("button", { className: "vk_mgrBtn vk_mgrBtnDanger", disabled: busy, onClick: () => { if (window.confirm("确定删除 MCP「" + s.serverName + "」？")) act(s.id, "delete"); } }, "删除")
						))
					)
			);
		}

		// ── 插件主体：注册三个管理分区到官方设置面板 ──
		const inject = ["slots"];
		function apply(ctx) {
			ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "persona",
				order: 1,
				label: () => "全局人设"
			}, PersonaSection)), "dsh-agent-manage: settings persona section");
			ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "skills",
				order: 2,
				label: () => "技能管理"
			}, SkillSection)), "dsh-agent-manage: settings skills section");
			ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "mcp",
				order: 3,
				label: () => "MCP 管理"
			}, MCPSection)), "dsh-agent-manage: settings mcp section");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
