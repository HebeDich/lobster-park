# Examples

该目录存放需要手动填写真实凭据后才能使用的样例配置。

## Real Delivery

用于验证平台通过真实渠道发送消息：

- `docs/examples/openclaw-real-delivery/telegram.env.example`
- `docs/examples/openclaw-real-delivery/discord.env.example`
- `docs/examples/openclaw-real-delivery/feishu.env.example`
- `docs/examples/openclaw-real-delivery/wecom.env.example`

也可以直接生成模板：

```bash
node scripts/openclaw-real-delivery-example.mjs telegram
```

## Live Acceptance

用于执行更完整的实例创建 → 配置 → 控制台对话 → 渠道发送链路 smoke：

- `docs/examples/openclaw-real-delivery/telegram-acceptance-live.env.example`
- `docs/examples/openclaw-real-delivery/discord-acceptance-live.env.example`
- `docs/examples/openclaw-real-delivery/feishu-acceptance-live.env.example`
- `docs/examples/openclaw-real-delivery/wecom-acceptance-live.env.example`

也可以直接生成模板：

```bash
node scripts/openclaw-acceptance-live-example.mjs telegram
```

## 报告输出

`pnpm openclaw:acceptance-live:report` 和 `pnpm openclaw:acceptance-live:index` 默认把生成文件写到：

`.tmp/reports/openclaw-live-acceptance/`

如需覆盖路径，可设置：

- `OPENCLAW_ACCEPTANCE_LIVE_REPORT_DIR`
- `OPENCLAW_ACCEPTANCE_LIVE_REPORT_PATH`

## 注意

- 示例文件只提供字段结构，不包含真实凭据
- 这些示例不属于默认开发启动路径
- 是否启用真实发送，完全由环境变量控制
- `WhatsApp` 使用二维码会话接入，默认不提供纯环境变量示例
