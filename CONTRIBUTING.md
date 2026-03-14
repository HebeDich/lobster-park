# Contributing

## Before You Start

- 先阅读 `README.md`
- 新功能和行为变更先提交设计说明或 Issue
- 保持改动聚焦，避免顺手重构无关代码

## Development

```bash
pnpm bootstrap
pnpm infra:up
pnpm server:dev
pnpm web:dev
```

## Expectations

- 改了什么就测什么
- 不提交密钥、测试产物、构建缓存
- 文档、类型和测试应与代码变更保持一致

## Pull Requests

- 描述问题、方案和验证方式
- 如涉及 UI，请附截图或录屏
- 如涉及配置或部署，请补文档
