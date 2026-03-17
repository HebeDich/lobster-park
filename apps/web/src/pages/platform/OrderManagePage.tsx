import { useEffect, useState } from 'react';
import { Card, Input, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { apiRequest, API_BASE_URL } from '@/api/client';

type OrderItem = {
  id: string;
  orderId: string;
  tradeId: string | null;
  userId: string;
  planId: string;
  plan: { name: string };
  payPlatform: string;
  amount: number;
  status: number;
  paymentChannel: string;
  paidAt: string | null;
  createdAt: string;
};

type OrderListResult = {
  pageNo: number;
  pageSize: number;
  total: number;
  items: OrderItem[];
};

const STATUS_MAP: Record<number, { text: string; color: string }> = {
  0: { text: '待支付', color: 'processing' },
  1: { text: '已支付', color: 'success' },
  2: { text: '已取消', color: 'default' },
  3: { text: '已退款', color: 'warning' },
};

const CHANNEL_MAP: Record<string, string> = {
  wxpay: '微信支付',
  alipay: '支付宝',
};

export function OrderManagePage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [data, setData] = useState<OrderListResult>({ pageNo: 1, pageSize: 20, total: 0, items: [] });
  const [loading, setLoading] = useState(false);
  const [searchUserId, setSearchUserId] = useState('');

  const loadOrders = async (pageNo = 1, pageSize = 20, userId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageNo: String(pageNo), pageSize: String(pageSize) });
      if (userId) params.set('userId', userId);
      const res = await apiRequest<OrderListResult>(`${API_BASE_URL}/orders?${params}`);
      setData(res.data ?? (res as unknown as OrderListResult));
    } catch {
      messageApi.error('加载订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadOrders(); }, []);

  const handleSearch = (value: string) => {
    setSearchUserId(value);
    void loadOrders(1, 20, value || undefined);
  };

  const columns: ColumnsType<OrderItem> = [
    { title: '订单号', dataIndex: 'orderId', key: 'orderId', width: 200, ellipsis: true },
    { title: '套餐', dataIndex: ['plan', 'name'], key: 'planName', width: 120 },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (v: number) => `¥${(v / 100).toFixed(2)}`,
    },
    {
      title: '渠道',
      dataIndex: 'paymentChannel',
      key: 'paymentChannel',
      width: 100,
      render: (v: string) => CHANNEL_MAP[v] || v,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: number) => {
        const item = STATUS_MAP[v] ?? { text: '未知', color: 'default' };
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
    { title: '流水号', dataIndex: 'tradeId', key: 'tradeId', width: 180, ellipsis: true, render: (v: string | null) => v || '-' },
    { title: '用户ID', dataIndex: 'userId', key: 'userId', width: 160, ellipsis: true },
    {
      title: '支付时间',
      dataIndex: 'paidAt',
      key: 'paidAt',
      width: 170,
      render: (v: string | null) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard
        title="订单管理"
        subtitle="查看和管理平台的所有支付订单"
        path="/platform/orders"
        permission="platform.settings.manage"
      />
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="按用户ID搜索"
            allowClear
            style={{ width: 320 }}
            value={searchUserId}
            onChange={(e) => setSearchUserId(e.target.value)}
            onSearch={handleSearch}
          />
        </div>
        <Table
          rowKey="id"
          dataSource={data.items}
          columns={columns}
          loading={loading}
          size="middle"
          scroll={{ x: 1200 }}
          pagination={{
            current: data.pageNo,
            pageSize: data.pageSize,
            total: data.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, size) => void loadOrders(page, size, searchUserId || undefined),
          }}
        />
      </Card>
    </div>
  );
}
