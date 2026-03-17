/**
 * Lobster Browser Bridge - Popup Script
 * 管理连接配置和状态显示
 */

const statusDot = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');
const serverUrlInput = document.getElementById('serverUrl');
const authTokenInput = document.getElementById('authToken');
const btnConnect = document.getElementById('btnConnect');
const btnDisconnect = document.getElementById('btnDisconnect');

const STATUS_MAP = {
  connected: { label: '已连接', dotClass: 'connected' },
  connecting: { label: '连接中...', dotClass: 'connecting' },
  disconnected: { label: '未连接', dotClass: 'disconnected' },
};

function updateUI(state, serverUrl, hasToken) {
  const info = STATUS_MAP[state] || STATUS_MAP.disconnected;
  statusDot.className = 'status-dot ' + info.dotClass;
  statusLabel.textContent = info.label;

  if (state === 'connected') {
    btnConnect.style.display = 'none';
    btnDisconnect.style.display = '';
    serverUrlInput.disabled = true;
    authTokenInput.disabled = true;
  } else if (state === 'connecting') {
    btnConnect.style.display = '';
    btnConnect.disabled = true;
    btnConnect.textContent = '连接中...';
    btnDisconnect.style.display = 'none';
    serverUrlInput.disabled = true;
    authTokenInput.disabled = true;
  } else {
    btnConnect.style.display = '';
    btnConnect.disabled = false;
    btnConnect.textContent = '连接';
    btnDisconnect.style.display = 'none';
    serverUrlInput.disabled = false;
    authTokenInput.disabled = false;
  }
}

// 初始化：加载已保存的配置和状态
async function init() {
  const stored = await chrome.storage.local.get(['serverUrl', 'authToken']);
  if (stored.serverUrl) serverUrlInput.value = stored.serverUrl;
  if (stored.authToken) authTokenInput.value = stored.authToken;

  chrome.runtime.sendMessage({ type: 'get_state' }, (response) => {
    if (response) {
      updateUI(response.state, response.serverUrl, response.hasToken);
    }
  });
}

// 连接按钮
btnConnect.addEventListener('click', async () => {
  const serverUrl = serverUrlInput.value.trim().replace(/\/+$/, '');
  const authToken = authTokenInput.value.trim();

  if (!serverUrl) {
    serverUrlInput.style.borderColor = '#e74c3c';
    serverUrlInput.focus();
    return;
  }
  if (!authToken) {
    authTokenInput.style.borderColor = '#e74c3c';
    authTokenInput.focus();
    return;
  }

  serverUrlInput.style.borderColor = '';
  authTokenInput.style.borderColor = '';
  updateUI('connecting');

  chrome.runtime.sendMessage({
    type: 'connect',
    serverUrl,
    authToken,
  }, () => {});
});

// 断开按钮
btnDisconnect.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'disconnect' }, () => {
    updateUI('disconnected');
  });
});

// 监听来自 background 的状态更新
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'state_update') {
    updateUI(msg.state, msg.serverUrl);
  }
});

// 输入框焦点清除红色边框
serverUrlInput.addEventListener('focus', () => { serverUrlInput.style.borderColor = ''; });
authTokenInput.addEventListener('focus', () => { authTokenInput.style.borderColor = ''; });

init();
