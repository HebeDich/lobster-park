/**
 * OpenClaw Browser Bridge - Background Service Worker
 * 负责与云端 BrowserBridge Gateway 建立 WebSocket 连接，接收并执行浏览器指令
 */

// 连接状态
let ws = null;
let connectionState = 'disconnected'; // disconnected | connecting | connected
let serverUrl = '';
let authToken = '';
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;
const BASE_RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 30000;

// 待处理的指令确认队列 (需要用户确认的指令)
const pendingConfirmations = new Map();

// 从 config.json 加载预置平台地址
async function loadDefaultConfig() {
  try {
    const resp = await fetch(chrome.runtime.getURL('config.json'));
    if (resp.ok) return await resp.json();
  } catch {}
  return {};
}

// 从 storage 加载配置（首次使用时以 config.json 为默认值）
async function loadConfig() {
  const result = await chrome.storage.local.get(['serverUrl', 'authToken', 'autoConnect', '_configLoaded']);
  if (!result._configLoaded) {
    const defaults = await loadDefaultConfig();
    if (defaults.serverUrl && !result.serverUrl) {
      result.serverUrl = defaults.serverUrl;
      await chrome.storage.local.set({ serverUrl: defaults.serverUrl, _configLoaded: true });
    }
  }
  serverUrl = result.serverUrl || '';
  authToken = result.authToken || '';
  return result;
}

// 保存配置
async function saveConfig(config) {
  await chrome.storage.local.set(config);
  if (config.serverUrl !== undefined) serverUrl = config.serverUrl;
  if (config.authToken !== undefined) authToken = config.authToken;
}

// 通知 popup 状态变化
function broadcastState() {
  chrome.runtime.sendMessage({
    type: 'state_update',
    state: connectionState,
    serverUrl,
  }).catch(() => {});
}

// 建立 WebSocket 连接
function connect() {
  if (!serverUrl || !authToken) {
    connectionState = 'disconnected';
    broadcastState();
    return;
  }

  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }

  connectionState = 'connecting';
  broadcastState();

  try {
    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws/v1/browser-bridge?token=' + encodeURIComponent(authToken);
    ws = new WebSocket(wsUrl);
  } catch (err) {
    console.error('[OpenClaw] WebSocket 创建失败:', err);
    connectionState = 'disconnected';
    broadcastState();
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('[OpenClaw] 已连接到服务器');
    connectionState = 'connected';
    reconnectAttempts = 0;
    broadcastState();
    // 发送心跳
    startHeartbeat();
  };

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'ping') {
        wsSend({ type: 'pong' });
        return;
      }
      if (msg.type === 'command') {
        await handleCommand(msg);
      }
    } catch (err) {
      console.error('[OpenClaw] 消息处理失败:', err);
    }
  };

  ws.onclose = (event) => {
    console.log('[OpenClaw] 连接关闭:', event.code, event.reason);
    ws = null;
    connectionState = 'disconnected';
    broadcastState();
    stopHeartbeat();
    if (event.code !== 4000) { // 4000 = 主动断开
      scheduleReconnect();
    }
  };

  ws.onerror = (err) => {
    console.error('[OpenClaw] WebSocket 错误:', err);
  };
}

// 发送消息
function wsSend(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// 心跳
let heartbeatTimer = null;
function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    wsSend({ type: 'heartbeat', ts: Date.now() });
  }, 25000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// 重连
function scheduleReconnect() {
  if (reconnectTimer) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('[OpenClaw] 已达最大重连次数');
    return;
  }
  const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  console.log(`[OpenClaw] ${delay}ms 后重连 (第 ${reconnectAttempts} 次)`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

// 主动断开
function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // 阻止自动重连
  stopHeartbeat();
  if (ws) {
    try { ws.close(4000, 'user_disconnect'); } catch {}
    ws = null;
  }
  connectionState = 'disconnected';
  broadcastState();
}

// 处理服务端下发的指令
async function handleCommand(msg) {
  const { commandId, action, params } = msg;
  if (!commandId || !action) {
    wsSend({ type: 'command_result', commandId, success: false, error: '无效的指令格式' });
    return;
  }

  try {
    let result;
    switch (action) {
      case 'navigate':
        result = await cmdNavigate(params);
        break;
      case 'getContent':
        result = await cmdGetContent(params);
        break;
      case 'screenshot':
        result = await cmdScreenshot(params);
        break;
      case 'querySelector':
        result = await cmdQuerySelector(params);
        break;
      case 'click':
        result = await cmdClick(params);
        break;
      case 'input':
        result = await cmdInput(params);
        break;
      case 'executeScript':
        result = await cmdExecuteScript(params);
        break;
      case 'getTabs':
        result = await cmdGetTabs(params);
        break;
      default:
        result = { success: false, error: `不支持的指令: ${action}` };
    }
    wsSend({ type: 'command_result', commandId, ...result });
  } catch (err) {
    wsSend({ type: 'command_result', commandId, success: false, error: err.message || String(err) });
  }
}

// ========== 指令实现 ==========

// 导航到指定 URL
async function cmdNavigate(params) {
  const { url, newTab } = params || {};
  if (!url) return { success: false, error: '缺少 url 参数' };

  let tab;
  if (newTab) {
    tab = await chrome.tabs.create({ url, active: true });
  } else {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) return { success: false, error: '没有活动标签页' };
    tab = await chrome.tabs.update(activeTab.id, { url });
  }

  // 等待页面加载完成
  await waitForTabLoad(tab.id, 30000);
  const updatedTab = await chrome.tabs.get(tab.id);

  return {
    success: true,
    data: {
      tabId: updatedTab.id,
      url: updatedTab.url,
      title: updatedTab.title,
      status: updatedTab.status,
    },
  };
}

// 获取页面内容
async function cmdGetContent(params) {
  const { tabId, selector, mode } = params || {};
  const targetTabId = tabId || (await getActiveTabId());
  if (!targetTabId) return { success: false, error: '没有活动标签页' };

  const contentMode = mode || 'text'; // text | html | readability

  const results = await chrome.scripting.executeScript({
    target: { tabId: targetTabId },
    func: (sel, cMode) => {
      const target = sel ? document.querySelector(sel) : document.body;
      if (!target) return { error: '未找到指定元素' };

      if (cMode === 'html') {
        return { content: target.innerHTML, title: document.title, url: location.href };
      }

      // 简化的 readability 模式：提取主要文本内容
      if (cMode === 'readability') {
        const article = document.querySelector('article') || document.querySelector('main') || document.querySelector('[role="main"]') || target;
        // 移除脚本、样式、导航等
        const clone = article.cloneNode(true);
        clone.querySelectorAll('script, style, nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"]').forEach(el => el.remove());
        return { content: clone.textContent.replace(/\s+/g, ' ').trim(), title: document.title, url: location.href };
      }

      return { content: target.innerText || target.textContent, title: document.title, url: location.href };
    },
    args: [selector || null, contentMode],
  });

  const result = results?.[0]?.result;
  if (!result) return { success: false, error: '脚本执行无返回' };
  if (result.error) return { success: false, error: result.error };

  return { success: true, data: result };
}

// 截图
async function cmdScreenshot(params) {
  const { tabId, quality } = params || {};
  const targetTabId = tabId || (await getActiveTabId());
  if (!targetTabId) return { success: false, error: '没有活动标签页' };

  // 确保目标标签页是活动的
  await chrome.tabs.update(targetTabId, { active: true });
  // 等待一小段时间让页面渲染
  await sleep(200);

  const dataUrl = await chrome.tabs.captureVisibleTab(null, {
    format: 'png',
    quality: quality || 80,
  });

  return {
    success: true,
    data: {
      dataUrl,
      format: 'png',
    },
  };
}

// 查询 DOM 元素
async function cmdQuerySelector(params) {
  const { tabId, selector, all } = params || {};
  if (!selector) return { success: false, error: '缺少 selector 参数' };
  const targetTabId = tabId || (await getActiveTabId());
  if (!targetTabId) return { success: false, error: '没有活动标签页' };

  const results = await chrome.scripting.executeScript({
    target: { tabId: targetTabId },
    func: (sel, queryAll) => {
      const elements = queryAll ? [...document.querySelectorAll(sel)] : [document.querySelector(sel)].filter(Boolean);
      return elements.map((el, i) => ({
        index: i,
        tagName: el.tagName.toLowerCase(),
        id: el.id || null,
        className: el.className || null,
        text: (el.innerText || el.textContent || '').slice(0, 200),
        href: el.href || null,
        src: el.src || null,
        value: el.value !== undefined ? el.value : null,
        visible: el.offsetParent !== null,
        rect: (() => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })(),
      }));
    },
    args: [selector, !!all],
  });

  const elements = results?.[0]?.result || [];
  return { success: true, data: { count: elements.length, elements } };
}

// 点击元素
async function cmdClick(params) {
  const { tabId, selector, index } = params || {};
  if (!selector) return { success: false, error: '缺少 selector 参数' };
  const targetTabId = tabId || (await getActiveTabId());
  if (!targetTabId) return { success: false, error: '没有活动标签页' };

  const results = await chrome.scripting.executeScript({
    target: { tabId: targetTabId },
    func: (sel, idx) => {
      const elements = [...document.querySelectorAll(sel)];
      const target = elements[idx || 0];
      if (!target) return { error: `未找到元素: ${sel}` };
      target.click();
      return { clicked: true, tagName: target.tagName.toLowerCase(), text: (target.innerText || '').slice(0, 100) };
    },
    args: [selector, index || 0],
  });

  const result = results?.[0]?.result;
  if (!result) return { success: false, error: '脚本执行无返回' };
  if (result.error) return { success: false, error: result.error };

  return { success: true, data: result };
}

// 输入文本
async function cmdInput(params) {
  const { tabId, selector, value, clear } = params || {};
  if (!selector) return { success: false, error: '缺少 selector 参数' };
  if (value === undefined) return { success: false, error: '缺少 value 参数' };
  const targetTabId = tabId || (await getActiveTabId());
  if (!targetTabId) return { success: false, error: '没有活动标签页' };

  const results = await chrome.scripting.executeScript({
    target: { tabId: targetTabId },
    func: (sel, val, shouldClear) => {
      const target = document.querySelector(sel);
      if (!target) return { error: `未找到元素: ${sel}` };
      if (shouldClear) target.value = '';
      target.focus();
      // 模拟逐字输入
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(target, (shouldClear ? '' : target.value) + val);
      } else {
        target.value = (shouldClear ? '' : target.value) + val;
      }
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      return { filled: true, currentValue: target.value };
    },
    args: [selector, value, !!clear],
  });

  const result = results?.[0]?.result;
  if (!result) return { success: false, error: '脚本执行无返回' };
  if (result.error) return { success: false, error: result.error };

  return { success: true, data: result };
}

// 执行自定义脚本
async function cmdExecuteScript(params) {
  const { tabId, code } = params || {};
  if (!code) return { success: false, error: '缺少 code 参数' };
  const targetTabId = tabId || (await getActiveTabId());
  if (!targetTabId) return { success: false, error: '没有活动标签页' };

  const results = await chrome.scripting.executeScript({
    target: { tabId: targetTabId },
    func: new Function('return (async () => { ' + code + ' })()'),
  });

  return { success: true, data: { result: results?.[0]?.result ?? null } };
}

// 获取所有标签页
async function cmdGetTabs() {
  const tabs = await chrome.tabs.query({});
  return {
    success: true,
    data: {
      tabs: tabs.map(t => ({
        id: t.id,
        url: t.url,
        title: t.title,
        active: t.active,
        windowId: t.windowId,
      })),
    },
  };
}

// ========== 工具函数 ==========

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id || null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForTabLoad(tabId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(); // 超时不报错，可能页面部分加载
    }, timeout);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ========== 消息监听 (来自 popup) ==========

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'get_state') {
    sendResponse({ state: connectionState, serverUrl, hasToken: !!authToken });
    return;
  }
  if (msg.type === 'connect') {
    (async () => {
      await saveConfig({ serverUrl: msg.serverUrl, authToken: msg.authToken });
      reconnectAttempts = 0;
      connect();
      sendResponse({ ok: true });
    })();
    return true; // 异步
  }
  if (msg.type === 'disconnect') {
    disconnect();
    sendResponse({ ok: true });
    return;
  }
});

// 启动时自动连接
(async () => {
  const config = await loadConfig();
  if (config.autoConnect && config.serverUrl && config.authToken) {
    connect();
  }
})();
