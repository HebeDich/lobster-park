#!/usr/bin/env node
// browser-bridge CLI — 供 OpenClaw Agent 的 exec 工具调用
// 通过平台 API 控制用户本地浏览器（需浏览器桥接扩展已连接）
//
// 环境变量：
//   BROWSER_BRIDGE_API   — 平台 API 地址，如 http://127.0.0.1:3000
//   BROWSER_BRIDGE_TOKEN — 用户桥接令牌
//
// 用法：
//   browser-bridge status                        检查扩展连接状态
//   browser-bridge open <url>                    打开网址
//   browser-bridge state                         获取当前页面内容（URL、标题、正文摘要）
//   browser-bridge click <selector>              点击元素
//   browser-bridge input <selector> <text>       在元素中输入文字
//   browser-bridge screenshot                    截取当前页面截图
//   browser-bridge eval <javascript>             执行 JavaScript 并返回结果
//   browser-bridge scroll <direction>            滚动页面（up/down）
//   browser-bridge back                          浏览器后退
//   browser-bridge forward                       浏览器前进
//   browser-bridge tabs                          列出所有标签页

'use strict';

const API_BASE = process.env.BROWSER_BRIDGE_API || 'http://127.0.0.1:3000';
const TOKEN = process.env.BROWSER_BRIDGE_TOKEN || '';

// ========== 命令映射 ==========

const COMMAND_MAP = {
  status:     { action: 'status',     needsParams: false },
  open:       { action: 'navigate',   needsParams: true,  paramBuilder: (args) => ({ url: args[0] }) },
  navigate:   { action: 'navigate',   needsParams: true,  paramBuilder: (args) => ({ url: args[0] }) },
  state:      { action: 'getContent', needsParams: false },
  content:    { action: 'getContent', needsParams: false },
  click:      { action: 'click',      needsParams: true,  paramBuilder: (args) => ({ selector: args[0] }) },
  input:      { action: 'input',      needsParams: true,  paramBuilder: (args) => ({ selector: args[0], value: args.slice(1).join(' ') }) },
  type:       { action: 'input',      needsParams: true,  paramBuilder: (args) => ({ selector: args[0], value: args.slice(1).join(' ') }) },
  screenshot: { action: 'screenshot', needsParams: false },
  eval:       { action: 'eval',       needsParams: true,  paramBuilder: (args) => ({ expression: args.join(' ') }) },
  scroll:     { action: 'scroll',     needsParams: true,  paramBuilder: (args) => ({ direction: args[0] || 'down', amount: Number(args[1]) || 500 }) },
  back:       { action: 'back',       needsParams: false },
  forward:    { action: 'forward',    needsParams: false },
  tabs:       { action: 'getTabs',    needsParams: false },
};

// ========== HTTP 请求 ==========

async function callApi(action, params, timeout) {
  const url = `${API_BASE.replace(/\/+$/, '')}/api/v1/browser-bridge/cli-execute`;
  const body = JSON.stringify({ action, params: params || {}, timeout: timeout || 30000 });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), (timeout || 30000) + 5000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {}),
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const json = await response.json();
    return json;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: '请求超时' };
    }
    return { success: false, error: `请求失败: ${err.message}` };
  }
}

// ========== 输出格式化 ==========

function formatOutput(result) {
  if (!result || typeof result !== 'object') {
    return JSON.stringify(result, null, 2);
  }

  // 错误处理
  if (result.success === false || result.error) {
    return `错误: ${result.error || '未知错误'}`;
  }

  // status 命令
  if (result.connected !== undefined) {
    return result.connected
      ? `浏览器扩展已连接 (在线时长: ${Math.round((Date.now() - result.connectedAt) / 1000)}秒)`
      : '浏览器扩展未连接。请确认扩展已安装并已输入桥接令牌。';
  }

  // getContent / state 命令
  if (result.data && (result.data.url || result.data.title || result.data.text)) {
    const d = result.data;
    const parts = [];
    if (d.url) parts.push(`URL: ${d.url}`);
    if (d.title) parts.push(`标题: ${d.title}`);
    if (d.text) parts.push(`\n内容:\n${d.text}`);
    return parts.join('\n');
  }

  // screenshot 命令 — 输出 base64 长度提示
  if (result.data && result.data.screenshot) {
    const len = result.data.screenshot.length;
    return `截图已获取 (base64 长度: ${len})。数据存储在 result.data.screenshot 中。`;
  }

  // 通用返回
  return JSON.stringify(result.data || result, null, 2);
}

// ========== 帮助信息 ==========

function showHelp() {
  console.log(`browser-bridge — 控制用户本地浏览器

用法:
  browser-bridge <command> [arguments...]

命令:
  status                       检查浏览器扩展连接状态
  open <url>                   打开网址
  state                        获取当前页面内容
  click <selector>             点击元素 (CSS 选择器)
  input <selector> <text>      在元素中输入文字
  screenshot                   截取页面截图
  eval <javascript>            执行 JavaScript
  scroll <up|down> [amount]    滚动页面
  back                         浏览器后退
  forward                      浏览器前进
  tabs                         列出所有标签页

环境变量:
  BROWSER_BRIDGE_API           平台 API 地址 (默认: http://127.0.0.1:3000)
  BROWSER_BRIDGE_TOKEN         桥接令牌

示例:
  browser-bridge open https://example.com
  browser-bridge state
  browser-bridge click "#login-btn"
  browser-bridge input "#username" "admin"
  browser-bridge eval "document.querySelectorAll('a').length"
`);
}

// ========== 主流程 ==========

async function main() {
  const args = process.argv.slice(2);
  const command = (args[0] || '').toLowerCase();

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  if (!TOKEN) {
    console.error('错误: 未设置 BROWSER_BRIDGE_TOKEN 环境变量');
    process.exit(1);
  }

  const cmdDef = COMMAND_MAP[command];
  if (!cmdDef) {
    console.error(`未知命令: ${command}\n运行 browser-bridge help 查看可用命令`);
    process.exit(1);
  }

  const commandArgs = args.slice(1);

  if (cmdDef.needsParams && commandArgs.length === 0) {
    console.error(`命令 "${command}" 需要参数。运行 browser-bridge help 查看用法。`);
    process.exit(1);
  }

  const params = cmdDef.paramBuilder ? cmdDef.paramBuilder(commandArgs) : {};
  const result = await callApi(cmdDef.action, params);
  console.log(formatOutput(result));
}

main().catch((err) => {
  console.error(`browser-bridge 执行失败: ${err.message}`);
  process.exit(1);
});
