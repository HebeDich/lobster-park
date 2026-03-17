# Browser Bridge Skill

## Purpose
让 OpenClaw Agent 能够通过浏览器桥接扩展控制用户的本地浏览器，执行网页浏览、表单填写、内容提取等操作。

## Best fit
- 你需要 Agent 操作用户本地浏览器（而非服务器端无头浏览器）
- 你需要访问需要用户登录态的页面
- 你需要 Agent 在用户可见的浏览器中执行自动化操作

## Not a fit
- 你只需要抓取公开网页内容（使用内置 browser 工具即可）
- 你不希望 Agent 有 exec 权限

## Quick orientation
- 确保用户已安装浏览器桥接扩展并已连接
- Agent 通过 `browser-bridge` CLI 命令控制浏览器
- 每次操作前建议先检查 `browser-bridge status`

## Required inputs
- 已安装并连接的浏览器桥接 Chrome 扩展
- 环境变量 `BROWSER_BRIDGE_API` 和 `BROWSER_BRIDGE_TOKEN` 已注入

## Commands

### 检查连接状态
```bash
browser-bridge status
```

### 打开网址
```bash
browser-bridge open <url>
```

### 获取页面内容
```bash
browser-bridge state
```

### 点击元素
```bash
browser-bridge click "<CSS选择器>"
```

### 输入文字
```bash
browser-bridge input "<CSS选择器>" "要输入的文字"
```

### 截图
```bash
browser-bridge screenshot
```

### 执行 JavaScript
```bash
browser-bridge eval "document.title"
```

### 滚动页面
```bash
browser-bridge scroll down
browser-bridge scroll up
```

### 浏览器导航
```bash
browser-bridge back
browser-bridge forward
```

### 列出标签页
```bash
browser-bridge tabs
```

## Operational notes
- 每次操作后用 `browser-bridge state` 确认页面状态
- 如果返回"浏览器扩展未连接"，提示用户先连接扩展
- 点击/输入操作使用 CSS 选择器定位元素
- 操作用户浏览器前应告知用户即将进行的操作
