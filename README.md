# dsh-agent-manage

DSH（DeepSeek Harness / Bigfish）独立管理插件：**全局人设注入 + Skill 管理 + MCP 动态管理**。
host 半体提供 `/agent-manage/*` HTTP 接口，client 半体在官方设置面板注册「全局人设 / 技能管理 / MCP 管理」三个分区。

> 私有插件（`"private": true`），未发布 npm。

## 出处

本插件修改自 **dsh-vscode-layout** 项目（2026-08）：抽离其管理功能（全局人设注入 / Skill 管理 / MCP 管理）独立成插件。原包名 `@anoslide/dsh-host-manage`，后更名 `@ayato233/dsh-agent-manage`，路由前缀 `/vscode-manage/*` 同步改为 `/agent-manage/*`（与已废弃的布局文件路由 `/vscode-files` 分开，避免将来恢复布局时 webServer 路由冲突）。

## 功能特性

1. **全局人设**：读写 `~/.dsh/global-persona.md`，注入所有会话的 systemPrompt（prompt 段 `user:global-persona`，order 1，紧随官方 persona order 0 之后）。
2. **Skill 管理**：管理 `~/.dsh/skills` 下的全局技能（目录含 SKILL.md，或单文件 .md）。关闭 = 标记 `.disabled`，不删除内容；删除走回收站。
3. **MCP 管理**：管理 `~/.dsh/mcp-servers.json`，支持 stdio / url 两种传输的 server 增删改与开关，开关即时生效（动态挂载 `dsh-mcp-client`），无需重启。

## 架构

```
lib/index.js   host 半体：inject [webServer]，挂 /agent-manage/* 路由，读写三个数据文件
lib/client.js  client 半体：注入 @deepseek-ai/dsh-client-runtime/client，注册设置面板三分区（样式走官方 --dsw-* 变量，主题感知）
```

## 安装

### 前置条件

- 已安装 DSH（Bigfish），profile 目录为 `~/.dsh/profiles/web`（默认）
- 全局数据目录 `~/.dsh/` 可写（插件读写 `global-persona.md` / `skills/` / `mcp-servers.json`）

### 安装步骤

1. **拷贝插件到安装位置**（从仓库拷贝 `lib/` 与 `package.json`）：

```powershell
# 在仓库根目录执行
New-Item -ItemType Directory -Force "$env:USERPROFILE\.dsh\profiles\web\node_modules\@ayato233\dsh-agent-manage" | Out-Null
Copy-Item lib\index.js, lib\client.js, package.json "$env:USERPROFILE\.dsh\profiles\web\node_modules\@ayato233\dsh-agent-manage\" -Force
```

2. **挂载**：在 `~/.dsh/profiles/web/cordis.patch.yml` 中追加：

```yaml
- insert:
    - id: dsh-agent-manage
      name: '@ayato233/dsh-agent-manage'
```

3. **重启 Bigfish** 生效。

### 验证

- 设置面板出现「全局人设 / 技能管理 / MCP 管理」三个分区；
- host 接口可访问：

```powershell
Invoke-RestMethod http://127.0.0.1:12652/agent-manage/persona
# 预期返回 { ok: true, content: "<全局人设内容>" }
```

### 更新

```bash
# 1. 修改源码（lib/）后做语法检查
node --check lib/index.js && node --check lib/client.js
# 2. 拷贝到安装位置
copy lib\index.js  %USERPROFILE%\.dsh\profiles\web\node_modules\@ayato233\dsh-agent-manage\lib\
copy lib\client.js %USERPROFILE%\.dsh\profiles\web\node_modules\@ayato233\dsh-agent-manage\lib\
# 3. 重启 Bigfish 生效
```

### 卸载

1. 移除 `cordis.patch.yml` 中的 `dsh-agent-manage` insert 段；
2. 删除安装目录 `~/.dsh/profiles/web/node_modules/@ayato233/dsh-agent-manage`；
3. 重启 Bigfish。插件管理的三个数据文件（`global-persona.md` / `skills/` / `mcp-servers.json`）默认保留，不会随卸载删除。

## HTTP API（host 半体）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/agent-manage/persona` | 读取全局人设 `{ ok, content }` |
| POST | `/agent-manage/persona` | 写入人设，body `{ content }` |
| GET | `/agent-manage/skills` | 列出全局 Skill `{ ok, skills }` |
| POST | `/agent-manage/skills/toggle` | 开关 Skill，body `{ path }` |
| POST | `/agent-manage/skills/delete` | 删除 Skill（回收站），body `{ path }` |
| GET | `/agent-manage/mcp` | 列出 MCP server `{ ok, servers }` |
| POST | `/agent-manage/mcp/toggle` | 开关 server，body `{ id }` |
| POST | `/agent-manage/mcp/delete` | 删除 server，body `{ id }` |
| POST | `/agent-manage/mcp/add` | 添加 server，body `{ serverName, transport, command, args, url, env, headers }` |

## 设置面板分区（client 半体）

- **全局人设**：textarea 编辑 + 保存
- **技能管理**：列表 + 开关 / 删除
- **MCP 管理**：列表 + 开关 / 删除 / 添加（含密钥字段，界面已提示勿外传）

## 数据文件

| 文件 | 用途 | 注意 |
| --- | --- | --- |
| `~/.dsh/global-persona.md` | 全局人设（注入源） | 改人设只改此文件 |
| `~/.dsh/skills/` | 全局技能目录 | 关闭 = `.disabled` 标记 |
| `~/.dsh/mcp-servers.json` | MCP server 配置 | ⚠️ 含密钥，勿外传 / 勿提交 |

## 目录结构

```
dsh-agent-manage/
├── lib/
│   ├── index.js    # host 半体（路由 / 数据读写 / MCP 动态挂载）
│   └── client.js   # client 半体（设置面板三分区）
├── package.json    # @ayato233/dsh-agent-manage v0.1.0 (private)
├── README.md
└── .gitignore
```

## 版本历史

- **0.1.0**（2026-08）：从 dsh-vscode-layout 抽离管理功能；更名 @ayato233/dsh-agent-manage。
