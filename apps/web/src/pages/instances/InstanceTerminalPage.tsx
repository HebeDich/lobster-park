import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Space, Tag, Typography, message } from 'antd';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useParams } from 'react-router-dom';
import { PageHeaderCard } from '@/components/PageHeaderCard';

type TerminalChunk = {
  cursor: number;
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
  timestamp: string;
};

type TerminalSession = {
  sessionId: string;
  startedAt: string;
  executionTarget: 'host' | 'container';
  cwd: string;
  cursor: number;
  chunks: TerminalChunk[];
  closed: boolean;
  exitCode?: number | null;
  idleTimeoutSeconds: number;
  cols: number;
  rows: number;
};

type WsTicket = {
  ticket: string;
  expiresIn: number;
};

type TerminalSocketMessage =
  | {
      type: 'ready';
      sessionId: string;
      instanceId: string;
      executionTarget: 'host' | 'container';
      cwd: string;
      cols: number;
      rows: number;
      closed: boolean;
      exitCode?: number | null;
      cursor: number;
    }
  | {
      type: 'output';
      cursor: number;
      stream: 'stdout' | 'stderr' | 'system';
      data: string;
      timestamp: string;
    }
  | {
      type: 'exit';
      sessionId: string;
      exitCode?: number | null;
    }
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'pong';
      timestamp: string;
    };

type TerminalStatus = 'idle' | 'connecting' | 'connected' | 'closed' | 'error';

async function request<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }
  if (!response.ok) {
    throw new Error(payload?.message || payload?.data?.message || `请求失败: ${response.status}`);
  }
  return (payload?.data ?? payload) as T;
}

function buildTerminalUrl(ticket: string, instanceId: string, sessionId: string, cursor: number) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = new URL(`${protocol}//${window.location.host}/ws/v1/terminal`);
  url.searchParams.set('ticket', ticket);
  url.searchParams.set('instanceId', instanceId);
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('cursor', String(cursor));
  return url.toString();
}

function renderStatusTag(status: TerminalStatus, closed: boolean) {
  if (closed) return <Tag>已关闭</Tag>;
  if (status === 'connected') return <Tag color='green'>已连接</Tag>;
  if (status === 'connecting') return <Tag color='processing'>连接中</Tag>;
  if (status === 'error') return <Tag color='red'>连接异常</Tag>;
  return <Tag>未连接</Tag>;
}

export function InstanceTerminalPage() {
  const { id = '' } = useParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [status, setStatus] = useState<TerminalStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const sessionIdRef = useRef('');
  const cursorRef = useRef(0);
  const disposedRef = useRef(false);
  const manualCloseRef = useRef(false);
  const autoOpenTimerRef = useRef<number | null>(null);

  const writeTerminal = (text: string) => {
    terminalRef.current?.write(text);
  };

  const writeSystemLine = (text: string) => {
    terminalRef.current?.writeln(`\r\n[system] ${text}`);
  };

  const fitTerminal = () => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) return null;
    fitAddon.fit();
    return {
      cols: terminal.cols,
      rows: terminal.rows,
    };
  };

  const sendResize = () => {
    const socket = socketRef.current;
    const next = fitTerminal();
    if (!socket || socket.readyState !== WebSocket.OPEN || !next || !sessionIdRef.current) return;
    socket.send(JSON.stringify({ type: 'resize', cols: next.cols, rows: next.rows }));
  };

  const closeSocket = () => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (!socket) return;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    socket.close();
  };

  const closeSession = async (silent = false) => {
    manualCloseRef.current = true;
    closeSocket();
    const currentSessionId = sessionIdRef.current;
    sessionIdRef.current = '';
    cursorRef.current = 0;
    if (!currentSessionId) {
      setSession((current) => (current ? { ...current, closed: true } : current));
      setStatus('closed');
      return;
    }
    try {
      await request(`/api/v1/instances/${id}/openclaw/terminal/sessions/${currentSessionId}`, {
        method: 'DELETE',
      });
      if (!silent) {
        messageApi.success('终端会话已关闭');
      }
    } catch (cause) {
      if (!silent) {
        setError(cause instanceof Error ? cause.message : '关闭终端失败');
      }
    } finally {
      setSession((current) => (current ? { ...current, closed: true } : current));
      setStatus('closed');
    }
  };

  const openSocket = async (nextSession: TerminalSession) => {
    const ticketResponse = await request<WsTicket>('/api/v1/ws/ticket', { method: 'POST' });
    if (!ticketResponse.ticket) {
      throw new Error('获取终端 websocket 凭证失败');
    }
    const socket = new WebSocket(buildTerminalUrl(ticketResponse.ticket, id, nextSession.sessionId, cursorRef.current));
    socketRef.current = socket;
    socket.onopen = () => {
      setStatus('connected');
      setError(null);
      terminalRef.current?.focus();
      sendResize();
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as TerminalSocketMessage;
        if (payload.type === 'ready') {
          cursorRef.current = payload.cursor;
          setSession((current) => current
            ? {
                ...current,
                cwd: payload.cwd,
                executionTarget: payload.executionTarget,
                closed: payload.closed,
                exitCode: payload.exitCode ?? current.exitCode ?? null,
                cols: payload.cols,
                rows: payload.rows,
              }
            : current);
          return;
        }
        if (payload.type === 'output') {
          cursorRef.current = payload.cursor;
          writeTerminal(payload.data);
          return;
        }
        if (payload.type === 'exit') {
          writeSystemLine(`会话已退出，退出码：${payload.exitCode ?? 'unknown'}`);
          setSession((current) => current ? { ...current, closed: true, exitCode: payload.exitCode ?? null } : current);
          setStatus('closed');
          sessionIdRef.current = '';
          return;
        }
        if (payload.type === 'error') {
          setError(payload.message);
          setStatus('error');
        }
      } catch {
        setError('终端消息解析失败');
        setStatus('error');
      }
    };
    socket.onerror = () => {
      setError('终端 websocket 连接异常');
      setStatus('error');
    };
    socket.onclose = () => {
      socketRef.current = null;
      if (disposedRef.current) return;
      if (!manualCloseRef.current) {
        setStatus((current) => (current === 'closed' ? current : 'error'));
      }
    };
  };

  const openSession = async (options: { showSuccessToast?: boolean } = {}) => {
    manualCloseRef.current = false;
    setBusy(true);
    setStatus('connecting');
    setError(null);
    if (sessionIdRef.current) {
      await closeSession(true);
    } else {
      closeSocket();
      sessionIdRef.current = '';
      cursorRef.current = 0;
    }
    terminalRef.current?.clear();
    terminalRef.current?.writeln('[system] 正在建立终端连接...');
    try {
      const size = fitTerminal();
      const nextSession = await request<TerminalSession>(`/api/v1/instances/${id}/openclaw/terminal/session`, {
        method: 'POST',
        body: JSON.stringify({
          cols: size?.cols,
          rows: size?.rows,
        }),
      });
      sessionIdRef.current = nextSession.sessionId;
      cursorRef.current = nextSession.cursor;
      setSession(nextSession);
      for (const chunk of nextSession.chunks ?? []) {
        writeTerminal(chunk.text);
      }
      await openSocket(nextSession);
      if (options.showSuccessToast) {
        messageApi.success('实例终端已连接');
      }
    } catch (cause) {
      if (sessionIdRef.current) {
        await closeSession(true);
      }
      setStatus('error');
      const nextError = cause instanceof Error ? cause.message : '创建终端失败';
      setError(nextError);
      writeSystemLine(nextError);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const container = terminalHostRef.current;
    if (!container) return;
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.25,
      fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
      scrollback: 5000,
      convertEol: false,
      theme: {
        background: '#0b1020',
        foreground: '#e5ecff',
        cursor: '#7dd3fc',
        selectionBackground: 'rgba(125, 211, 252, 0.25)',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    fitTerminal();
    terminal.writeln('[system] 终端已初始化');
    terminal.onData((data) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !sessionIdRef.current) return;
      socket.send(JSON.stringify({ type: 'input', data }));
    });

    const observer = new ResizeObserver(() => {
      sendResize();
    });
    observer.observe(container.parentElement ?? container);
    resizeObserverRef.current = observer;

    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    autoOpenTimerRef.current = window.setTimeout(() => {
      void openSession();
    }, 0);
    return () => {
      if (autoOpenTimerRef.current != null) {
        window.clearTimeout(autoOpenTimerRef.current);
        autoOpenTimerRef.current = null;
      }
      disposedRef.current = true;
      void closeSession(true);
    };
  }, [id]);

  return (
    <div style={{ display: 'grid', gap: 16, width: '100%', minWidth: 0 }}>
      {contextHolder}
      <PageHeaderCard
        title='实例终端'
        subtitle='真实 PTY 终端，直接进入当前实例工作目录或容器工作区'
        path={`/instances/${id}/terminal`}
        permission='instance.view'
        backTo={`/instances/${id}`}
        backLabel='返回实例概览'
      />
      {error ? <Alert type='error' showIcon message={error} /> : null}
      <Card style={{ minWidth: 0 }}>
        <Space wrap size='middle'>
          <Button type='primary' onClick={() => void openSession({ showSuccessToast: true })} loading={busy}>
            重新连接
          </Button>
          <Button onClick={() => void closeSession()} disabled={!sessionIdRef.current}>
            关闭终端
          </Button>
          <Button
            onClick={() => {
              const socket = socketRef.current;
              if (!socket || socket.readyState !== WebSocket.OPEN || !sessionIdRef.current) return;
              socket.send(JSON.stringify({ type: 'input', data: '\u0003' }));
            }}
            disabled={!sessionIdRef.current || status !== 'connected' || Boolean(session?.closed)}
          >
            发送 Ctrl+C
          </Button>
          <Button onClick={() => terminalRef.current?.clear()}>
            清空屏幕
          </Button>
          {renderStatusTag(status, Boolean(session?.closed))}
          {session ? <Tag>{session.executionTarget === 'container' ? '容器终端' : '工作目录终端'}</Tag> : null}
        </Space>
      </Card>
      <Card style={{ minWidth: 0 }} extra={session?.idleTimeoutSeconds ? <Typography.Text type='secondary'>空闲超时：{session.idleTimeoutSeconds}s</Typography.Text> : null}>
        <div
          style={{
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            background: '#0b1020',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(15, 23, 42, 0.96)',
              borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
            }}
          >
            <Space size={8}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fb7185', display: 'inline-block' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
            </Space>
            <Typography.Text style={{ color: 'rgba(226, 232, 240, 0.88)' }}>
              {session?.cwd || '/runtime/workspace'}
            </Typography.Text>
          </div>
          <div
            ref={terminalHostRef}
            style={{
              height: 560,
              padding: '10px 12px',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              overflow: 'hidden',
            }}
          />
        </div>
      </Card>
    </div>
  );
}
