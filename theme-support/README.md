# 实验候选：RStudio 公开主题接口

此目录供研究和上游讨论使用。普通用户请安装仓库根目录 `themes/` 下的主题。

`Stable` 表示示例尝试使用公开接口的设计，**不表示当前官方 RStudio 已提供这些新增接口**。未应用源码补丁时，不要用该文件替换已安装的 Claude Terminal Charcoal。完整 IDE 构建和带补丁 IDE 的端到端运行尚未完成。

## 内容与基准

- `rstudio-theme-hooks.patch`：增加主题类名、文档和一个实际 IDE 端到端测试。
- `claude-terminal-charcoal-stable.rstheme`：通过新增类定位对应表面，去除当前主题针对这些表面的编译类名及首尾子节点定位。
- 基准：[rstudio/rstudio @ 9c11fb25c2a24c4faa09f79befb1907dc8a825de](https://github.com/rstudio/rstudio/tree/9c11fb25c2a24c4faa09f79befb1907dc8a825de)。

新增接口：

| 公开类 | 对应位置 |
| --- | --- |
| `rstheme_primaryWindowFrameHeader` | PrimaryWindowFrame 标题条，包括不显示标签时的 Console 标题条 |
| `rstheme_toolbar` | Toolbar 内部承载控件的表格 |
| `rstheme_windowFrameHeader` | WindowFrame 中包裹标题控件的布局容器 |
| `rstheme_windowFrameContent` | WindowFrame 中包裹主内容或全尺寸内容的布局容器 |

原样式类保留。Java 只增加类名，不改变布局、控件、事件或默认颜色。内容与标题重新创建时，对应容器也获得类名；别名列入 CssResource 的 `@external` 声明。

其他 RStudio/Ace/GWT 样式类仍可能有版本依赖。系统标题栏和 Assistant iframe 不在范围内。

## 应用与验证

先下载本仓库，记下补丁的绝对路径。在上述基准提交的干净 RStudio 源码检出目录执行，`<community-repo>` 替换为本仓库路径：

```powershell
git apply --check '<community-repo>/theme-support/rstudio-theme-hooks.patch'
git apply '<community-repo>/theme-support/rstudio-theme-hooks.patch'
```

按该提交的 [贡献指南](https://github.com/rstudio/rstudio/blob/9c11fb25c2a24c4faa09f79befb1907dc8a825de/CONTRIBUTING.md) 完成开发构建，再在 `e2e/rstudio` 运行：

```powershell
npm ci
npm run typecheck
npx playwright test tests/panes/theme_hooks.test.ts --project=desktop --no-deps --list
npm run test:desktop -- tests/panes/theme_hooks.test.ts --workers=1
```

具体环境配置和运行命令以基准提交的 `e2e/rstudio/README.md` 为准。Desktop 测试必须指向带此修改的构建。测试发现 `--list`、TypeScript 检查和 CSS 解析均不能替代真正的 IDE 端到端运行。不要手工向 DOM 添加类来制造通过结果。

测试检查公开类存在、深浅主题颜色改变、几何不变和移除 CSS 后恢复；应在未打补丁版本上因缺少接口而失败。

带补丁构建验证通过后，再通过 Appearance 的 Add… 添加本目录示例，或在本社区仓库根目录的 RStudio 中运行：

```r
rstudioapi::addTheme(
  "theme-support/claude-terminal-charcoal-stable.rstheme",
  apply = TRUE
)
```

默认不覆盖同名主题。切回 Claude Terminal Charcoal 即可恢复普通版配色。

## 状态与上游范围

2026-10-16 发布整理时，从基准提交下载原文件，实际完成 `git apply --check`、应用、反向检查及反向应用，均退出 0，原文件字节恢复一致。该检查不包含构建、TypeScript 检查或 IDE 端到端运行。

补丁仅用于补齐具体主题定位接口；与 [主题文档讨论 #6239](https://github.com/rstudio/rstudio/issues/6239) 相关，不承诺解决该讨论中的所有主题问题。本仓库发布不等于已向 RStudio 创建 PR，也不等于上游接受该改动。贡献协议、构建和完整运行验证仍需按上游要求完成。

示例主题基于 RStudio Tomorrow Night Bright，沿用 AGPL-3.0；不是 Anthropic 官方主题。
