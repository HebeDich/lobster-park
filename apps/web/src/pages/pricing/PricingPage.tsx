import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Modal, Row, Spin, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, CrownOutlined, WechatOutlined } from '@ant-design/icons';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { apiRequest, API_BASE_URL } from '@/api/client';

type Plan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  maxInstances: number;
  allowedSpecs: string;
  validityDays: number | null;
  isActive: boolean;
};

type UserQuota = {
  maxInstances: number;
  allowedSpecs: string[];
  currentInstances: number;
  planName: string | null;
  expiresAt: string | null;
};

type BuyResult = {
  orderId: string;
  payUrl: string;
  isRedirect: boolean;
  channel: string;
};

export function PricingPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [loading, setLoading] = useState(true);

  // 支付弹窗状态
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [buying, setBuying] = useState(false);
  const [payUrl, setPayUrl] = useState('');
  const [orderId, setOrderId] = useState('');
  const [isRedirect, setIsRedirect] = useState(false);
  const [remainingTime, setRemainingTime] = useState(300);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, quotaRes] = await Promise.all([
        apiRequest<Plan[]>(`${API_BASE_URL}/plans?onlyActive=true`),
        apiRequest<UserQuota>(`${API_BASE_URL}/orders/my-quota`),
      ]);
      setPlans(plansRes.data ?? (plansRes as unknown as Plan[]));
      setQuota(quotaRes.data ?? (quotaRes as unknown as UserQuota));
    } catch {
      messageApi.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const cleanup = useCallback(() => {
    stopPolling();
    setSelectedPlan(null);
    setPayUrl('');
    setOrderId('');
    setIsRedirect(false);
    setRemainingTime(300);
    setBuying(false);
  }, [stopPolling]);

  useEffect(() => { if (!payModalOpen) cleanup(); }, [payModalOpen, cleanup]);
  useEffect(() => () => cleanup(), [cleanup]);

  const startCountdown = useCallback(() => {
    setRemainingTime(300);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          stopPolling();
          messageApi.warning('支付超时，请重新发起');
          setPayModalOpen(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopPolling, messageApi]);

  const startPolling = useCallback((oid: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiRequest<{ status: number }>(`${API_BASE_URL}/orders/query?orderId=${oid}`);
        const data = res.data ?? (res as unknown as { status: number });
        if (data.status === 1) {
          stopPolling();
          messageApi.success('支付成功！');
          setPayModalOpen(false);
          void loadData();
        }
      } catch { /* 静默 */ }
    }, 3000);
  }, [stopPolling, messageApi]);

  const handleBuy = async (plan: Plan, payType = 'wxpay') => {
    setSelectedPlan(plan);
    setPayModalOpen(true);
    setBuying(true);
    try {
      const res = await apiRequest<BuyResult>(`${API_BASE_URL}/orders/buy`, {
        method: 'POST',
        body: JSON.stringify({ planId: plan.id, payType }),
      });
      const data = res.data ?? (res as unknown as BuyResult);
      setOrderId(data.orderId);
      setIsRedirect(data.isRedirect);
      setPayUrl(data.payUrl);
      startCountdown();
      if (!data.isRedirect) {
        startPolling(data.orderId);
      }
    } catch {
      messageApi.error('创建订单失败');
      setPayModalOpen(false);
    } finally {
      setBuying(false);
    }
  };

  const handleRedirectPay = () => {
    if (payUrl && orderId) {
      window.open(payUrl, '_blank');
      startPolling(orderId);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard
        title="套餐中心"
        subtitle="选择适合您的套餐，解锁更多实例配额与高级规格"
        path="/pricing"
      />

      {quota ? (
        <Card size="small">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Tag color={quota.planName ? 'gold' : 'default'} icon={quota.planName ? <CrownOutlined /> : undefined}>
              {quota.planName || '免费版'}
            </Tag>
            <Typography.Text>实例：{quota.currentInstances} / {quota.maxInstances}</Typography.Text>
            <Typography.Text>规格：{quota.allowedSpecs.join(', ')}</Typography.Text>
            {quota.expiresAt ? <Typography.Text type="secondary">到期：{new Date(quota.expiresAt).toLocaleDateString()}</Typography.Text> : null}
          </div>
        </Card>
      ) : null}

      {plans.length === 0 ? (
        <Alert type="info" showIcon message="暂无可购买套餐，请联系管理员添加" />
      ) : (
        <Row gutter={[16, 16]}>
          {plans.map((plan) => (
            <Col key={plan.id} xs={24} sm={12} lg={8} xl={6}>
              <Card
                hoverable
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ flex: 1 }}>
                  <Typography.Title level={4} style={{ marginBottom: 4 }}>{plan.name}</Typography.Title>
                  {plan.description ? <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>{plan.description}</Typography.Paragraph> : null}
                  <Typography.Title level={2} style={{ color: '#f5222d', marginBottom: 16 }}>
                    ¥{(plan.priceCents / 100).toFixed(2)}
                  </Typography.Title>
                  <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                    <div><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />最多 {plan.maxInstances} 个实例</div>
                    <div><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />支持 {plan.allowedSpecs} 规格</div>
                    <div><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />{plan.validityDays ? `${plan.validityDays} 天有效` : '永久有效'}</div>
                  </div>
                </div>
                <Button
                  type="primary"
                  block
                  size="large"
                  style={{ marginTop: 20 }}
                  onClick={() => void handleBuy(plan)}
                >
                  立即购买
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        open={payModalOpen}
        title="购买套餐"
        onCancel={() => setPayModalOpen(false)}
        footer={null}
        destroyOnClose
        width={480}
      >
        {selectedPlan ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <Card size="small" style={{ background: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>套餐：{selectedPlan.name}</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#f5222d' }}>
                  ¥{(selectedPlan.priceCents / 100).toFixed(2)}
                </span>
              </div>
              {orderId && remainingTime > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: '#999' }}>
                  <span>订单号：{orderId}</span>
                  <span>剩余 {formatTime(remainingTime)}</span>
                </div>
              ) : null}
            </Card>

            {buying ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <Spin size="large" />
                <div style={{ marginTop: 12, color: '#999' }}>正在创建订单…</div>
              </div>
            ) : isRedirect ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <p>管理员启用了跳转支付模式</p>
                <Button type="primary" size="large" onClick={handleRedirectPay}>
                  点击前往支付
                </Button>
                <p style={{ marginTop: 8, color: '#999', fontSize: 12 }}>支付完成后页面会自动刷新</p>
              </div>
            ) : payUrl ? (
              <div style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ background: '#fff', padding: 16, display: 'inline-block', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payUrl)}`}
                    alt="支付二维码"
                    width={200}
                    height={200}
                  />
                </div>
                <p style={{ marginTop: 12, color: '#666' }}>
                  <WechatOutlined style={{ color: '#09bb07', marginRight: 4 }} />
                  请使用微信扫码支付
                </p>
                <p style={{ color: '#999', fontSize: 12 }}>支付完成后会自动跳转，请勿关闭此窗口</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
