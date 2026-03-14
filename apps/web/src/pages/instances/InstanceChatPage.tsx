import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Input, Space, Spin, Tag, message } from 'antd';
import { ArrowLeftOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { DefaultService } from '@/api';
import type { Instance } from '@/api/generated';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { extractOpenClawReplyText } from './openclaw-console-helpers';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

export function InstanceChatPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [instance, setInstance] = useState<Instance | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadInitial();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadInitial = async () => {
    setLoading(true);
    setError(null);
    try {
      const [instanceRes, historyRes] = await Promise.all([
        DefaultService.getInstance(id),
        DefaultService.getOpenClawConsoleHistory(id, 50),
      ]);
      setInstance(instanceRes.data ?? null);
      const historyItems = (historyRes.data?.items ?? []) as Array<Record<string, unknown>>;
      const loaded: ChatMessage[] = historyItems.map((item, index) => ({
        id: `hist_${index}`,
        role: item.role === 'user' ? 'user' : 'assistant',
        content: String(item.text ?? ''),
        timestamp: String(item.timestamp ?? ''),
      }));
      setMessages(loaded);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setSending(true);
    setError(null);

    try {
      const response = await DefaultService.sendOpenClawConsoleMessage(id, {
        mode: 'webchat',
        message: text,
        historyLimit: 8,
      });

      const data = response.data ?? null;
      const aiText = extractOpenClawReplyText(data) || '(无回复内容)';

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: aiText,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (cause) {
      const errMsg = cause instanceof Error ? cause.message : '发送失败';
      setError(errMsg);
      messageApi.error(errMsg);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const lifecycleColor = instance?.lifecycleStatus === 'running' ? 'green' : instance?.lifecycleStatus === 'stopped' ? 'red' : 'blue';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', maxHeight: 'calc(100vh - 64px)' }}>
      {contextHolder}

      {/* Header */}
      <Card size="small" style={{ flexShrink: 0, borderRadius: 0 }}>
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/instances/${id}`)}>返回实例概览</Button>
          <span style={{ fontWeight: 600 }}>{instance?.name ?? id}</span>
          <Tag color={lifecycleColor}>{instance?.lifecycleStatus ?? 'unknown'}</Tag>
          {instance?.runtimeVersion ? <Tag>{instance.runtimeVersion}</Tag> : null}
        </Space>
      </Card>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', background: '#f5f5f5' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : (
          <>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: 48 }}>发送一条消息开始对话</div>
            ) : null}
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '10px 16px',
                    borderRadius: 12,
                    background: msg.role === 'user' ? '#1677ff' : '#fff',
                    color: msg.role === 'user' ? '#fff' : '#333',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.role === 'assistant' ? (
                    <div className="chat-markdown" style={{ lineHeight: 1.6 }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  )}
                </div>
              </div>
            ))}
            {sending ? (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
                <div style={{ padding: '10px 16px', borderRadius: 12, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                  <Spin size="small" /> <span style={{ marginLeft: 8, color: '#999' }}>思考中...</span>
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error */}
      {error ? <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} style={{ margin: '0 24px' }} /> : null}

      {/* Input */}
      <div style={{ flexShrink: 0, padding: '12px 24px', borderTop: '1px solid #e8e8e8', background: '#fff' }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input.TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={sending}
            style={{ borderRadius: '8px 0 0 8px' }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => void handleSend()}
            loading={sending}
            disabled={!inputValue.trim()}
            style={{ height: 'auto', borderRadius: '0 8px 8px 0' }}
          >
            发送
          </Button>
        </Space.Compact>
      </div>
    </div>
  );
}
