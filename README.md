# RStudio Claude Style

给 RStudio 加上 Claude Code 风格的暖炭灰配色，复用 Posit Assistant 的侧栏、选区上下文和技能，把解释代码、最小修改、运行验证、绘图导出串起来。

Warm charcoal themes and native R workflows for RStudio + Posit Assistant, with an optional Windows Codex hook compatibility fix.

社区个人方案，非 Anthropic、OpenAI 或 Posit 官方产品。这里的 “Claude style” 指配色和工作方式；AI 功能来自你已有的 Posit Assistant 与模型服务，不是 Claude Code 的完整移植，也不附带模型、账号或免费额度。

## 包含什么

- **Claude Terminal Charcoal**：推荐主题。暖炭灰背景、暖白正文、陶土橙强调，覆盖编辑器、Console/Terminal 和部分面板、标题栏、滚动条。
- **Claude Terminal**：较早的配色版本，供切换比较。
- **`/r-code`**：从选区出发解释、排查和最小修改 R 代码，保留一个可运行检查。
- **`/r-plot`**：从真实 R 数据出发绘图、回读结果、保存脚本和 PNG/PDF，要求注明样本量与 NA 处理。
- **可选 Windows 修复**：修复特定 Posit Assistant / Codex 组合的钩子信任路径不匹配。主题和技能不要求安装此补丁。

系统标题栏、原生窗口及 Assistant iframe 内部不能完整换肤；不改变面板布局、字体、字号、快捷键或现有权限。

## 兼容范围

原方案在 Windows、RStudio **2026.09.0+174**、Posit Assistant **1.8.0**、内置 Codex **0.154.0** 上使用。绘图示例在 R **4.6.1** 上运行，Node 脚本在 Node.js **22.23.1** 上验证；不需要 npm 安装。

其他系统和版本尚未实测。主题里的部分 IDE 选择器依赖上述 RStudio 构建，升级后可能失效；技能依赖 Assistant 当前提供的选区、编辑、R 会话和图形工具。先确认你已有的 Assistant 能正常对话。模型服务仍使用你自己的认证、订阅或 API 配置。

## 快速开始

下载本仓库 ZIP 并解压，或运行：

```powershell
git clone https://github.com/Nigmat-future/rstudio-claude-style.git
cd rstudio-claude-style
```

### 1. 安装主题

在 RStudio 打开 **Tools > Global Options > Appearance**：

1. 记下当前的 RStudio theme 和 Editor theme，便于恢复。
2. 点击 **Add…**，选择 `themes/claude-terminal-charcoal.rstheme`。
3. RStudio theme 选 **Modern**，Editor theme 选 **Claude Terminal Charcoal**，点击 **Apply / OK**。

如果已安装 `rstudioapi`，也可以在仓库根目录的 RStudio R Console 中运行：

```r
rstudioapi::addTheme("themes/claude-terminal-charcoal.rstheme", apply = TRUE)
```

默认不覆盖同名主题。要试早期版本，用相同步骤添加 `themes/claude-terminal.rstheme`。主题格式和 API 见 [RStudio 官方外观文档](https://docs.posit.co/ide/user/ide/guide/ui/appearance.html)。

### 2. 安装两个技能

把 `skills/r-code` 和 `skills/r-plot` 两个目录复制到用户目录下的 `~/.posit/assistant/skills/`。保留 `技能名/SKILL.md` 结构；已有同名目录时先比较内容，不覆盖自己的版本。

Windows PowerShell 可在仓库根目录运行以下命令；任一同名目录已存在就停止：

```powershell
$skillRoot = Join-Path $env:USERPROFILE '.posit/assistant/skills'
foreach ($name in 'r-code', 'r-plot') {
    if (Test-Path -LiteralPath (Join-Path $skillRoot $name)) {
        throw "Skill already exists: $name"
    }
}
New-Item -ItemType Directory -Path $skillRoot -Force | Out-Null
Copy-Item -LiteralPath './skills/r-code', './skills/r-plot' -Destination $skillRoot -Recurse
```

新建 Assistant 对话后输入 `/r-`，应能选择 `/r-code` 和 `/r-plot`。如果没有候选，检查目录和 `skills.paths` 设置，再重新加载 Assistant。安装位置与加载规则见 [Posit Assistant Skills](https://assistant.posit.co/docs/features/skills/)。

### 3. 开始工作

在源代码编辑器选中代码，按 **Ctrl+Shift+I** 打开侧栏，在模型选择器中选择已配置的模型。

解释或审查时用 **Ask** 模式；需要编辑、执行 R 或绘图时，切到允许相应操作的模式，并按 Assistant 的权限提示操作。

```text
/r-code 解释当前选区，检查 NA 和分组行为；如有问题，只做最小修改并验证。
```

```text
/r-plot 用当前 R 会话的 iris，按 Species 分组画 Sepal.Length 和
Sepal.Width 散点图。标注单位、各组样本量和 NA 处理，保留 R 脚本，
导出 PNG/PDF，并回读检查图形。保存到一个新的输出目录，不能覆盖旧文件。
```

技能只是工作流程指令。效果取决于模型和实际工具；它们不会自动赋予执行权限，也不会替你安装模型或连接外部 R 会话。

## 可选：Windows Codex 钩子兼容修复

仅适用于上述版本组合出现 `Codex did not trust` 一类启动错误的情况。若已能正常对话，无需应用。

该版本的 Assistant 使用 Unix 风格的固定钩子信任键，而 Windows Codex 返回 Windows 路径键。修复会保存 `hooks/list` 返回的目标策略钩子的 `key` 与 `currentHash`，供重试使用；继续检查信任状态和意外的已信任钩子，不关闭钩子、不改变工具审批。

先保存工作，在 **Tools > Global Options > Assistant > Chat provider** 选 **(None)** 并 Apply，停止 Chat 后端。不要更改代码补全 provider。然后在仓库根目录的 PowerShell 执行：

```powershell
node ./fix-codex-hook.mjs --check
node --test ./tests/fix-codex-hook.test.mjs
node ./fix-codex-hook.mjs --apply
node ./check-codex-hooks.mjs --bundle "$env:LOCALAPPDATA/RStudio/pai/bin/dist/server/main.js"
```

检查默认定位当前用户的 Assistant `main.js`。补丁只接受四段与已审查适配器完全匹配的内容，**不是对整个安装包做版本或哈希认证**；不匹配时拒绝修改。非默认安装位置可给补丁脚本显式传 `--bundle '完整路径/main.js'`。不要对未审查的新版本强行套用。

原文件备份到同目录的 `main.js.before-windows-hook-fix`。目标文件通过同目录临时文件替换；备份不会覆盖不同内容。应用失败时保留备份，不要手工删除它后反复尝试。

`check-codex-hooks.mjs` 在临时 `CODEX_HOME` 中启动真实 Codex app-server，仅调用初始化和 `hooks/list`，不登录、不发模型请求、不执行 MCP 工具。默认查找 `0.154.0` 的 Windows x64 二进制；其他安装位置使用 `--codex '完整路径/codex.exe'`。

预期比较结果：`legacy` 为 `untrusted`，`corrected` 为 `trusted`。单独运行 `node ./check-codex-hooks.mjs --legacy` 会在有问题的 Windows 版本上以退出码 **1** 复现原错误，这不是修复后回归失败。该检查证明握手信任逻辑，不证明完整模型对话。

验证后把 Chat provider 选回 **Posit Assistant** 并 Apply/OK，新建对话。仅切换 Chat 后端通常不重启 R 会话；仍请先保存工作。Assistant 更新可能覆盖本地补丁。

### 恢复

- **主题**：在 Appearance 切回之前记下的主题；需要时用 `rstudioapi::removeTheme("Claude Terminal Charcoal")` 移除自定义主题。
- **技能**：只删除自己复制的 `r-code`、`r-plot` 目录，再新建对话。
- **兼容补丁**：停止 Chat 后端，运行 `node ./fix-codex-hook.mjs --restore`，再启用 Posit Assistant。若目标文件已被后续更新修改，恢复会拒绝覆盖；应使用 Assistant 的正常更新或重装流程。

## 可复现绘图示例

只用内置 `iris` 与 base R，不安装 R 包。在仓库根目录运行，输出目录必须没有同名结果：

```powershell
Rscript --vanilla ./examples/plot-demo.R ./demo-output
```

如果 `Rscript` 不在 PATH，在 RStudio 中运行：

```r
source("examples/plot-demo.R")
plot_demo("demo-output")
```

命令行方式自检：150 行数据、3 组各 50 行、NA 排除 0 行、PNG/PDF 写出、设备关闭，以及再次运行时拒绝覆盖且保留旧文件。绘图没有随机步骤。RStudio `source()` 方式只定义函数，不自动运行这些命令行自检。

下面是 base R 示例输出，不是 IDE 换肤截图：

![按物种分组的 iris 萼片散点图，颜色和点形共同区分三组](examples/output/iris-sepal.png)

## 开发中的主题接口

[`theme-support/`](theme-support/README.md) 单独保留面向 RStudio 源码的候选补丁和示例。那里的 `Stable` 主题依赖新增主题接口；这个名字不表示官方版本已支持。**普通安装使用 `themes/`，不要安装候选 Stable 文件。** 完整带补丁 IDE 的构建和端到端运行尚未完成。

## 验证与反馈

2026-10-16 发布整理时重新运行了真实 Codex 钩子握手比较和 base R 绘图自检；发布补丁脚本另有隔离临时文件测试。主题文件与原方案安装副本一致；原方案已有实际 IDE 使用记录，本次整理没有重新覆盖所有缩放比例、控件或完整 AI 对话。

欢迎通过 [Issues](https://github.com/Nigmat-future/rstudio-claude-style/issues) 提交问题，附操作系统、RStudio / Assistant / Codex 版本、复现步骤和删去凭据的最短错误信息。截图请先移除私人代码、数据和聊天。提交修复前运行相关检查，不要上传 Assistant 安装包、账号配置或聊天日志。

## 来源与许可

本仓库采用 [GNU AGPL v3.0](LICENSE)。主题基于 RStudio 自带的 Tomorrow Night Bright，保留上游来源；详见 [NOTICE](NOTICE)。兼容脚本只提供本地变更逻辑，不分发 Posit Assistant 本体。第三方产品、模型服务和商标仍遵循各自条款。
