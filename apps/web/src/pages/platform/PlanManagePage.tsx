import { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Space, Switch, Table, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
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
  displayOrder: number;
};

export function PlanManagePage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<Plan[]>(`${API_BASE_URL}/plans`);
      setPlans(res.data ?? (res as unknown as Plan[]));
    } catch {
      messageApi.error('加载套餐列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPlans(); }, []);

  const openCreate = () => {
    setEditingPlan(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, maxInstances: 1, allowedSpecs: 'S', displayOrder: 0 });
    setModalOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    form.setFieldsValue({
      ...plan,
      price: plan.priceCents / 100,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const body = {
        name: values.name,
        description: values.description || null,
        priceCents: Math.round(Number(values.price) * 100),
        maxInstances: values.maxInstances,
        allowedSpecs: values.allowedSpecs,
        validityDays: values.validityDays || null,
        isActive: values.isActive,
        displayOrder: values.displayOrder,
      };

      if (editingPlan) {
        await apiRequest(`${API_BASE_URL}/plans/${editingPlan.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        messageApi.success('套餐已更新');
      } else {
        await apiRequest(`${API_BASE_URL}/plans`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        messageApi.success('套餐已创建');
      }
      setModalOpen(false);
      void loadPlans();
    } catch {
      messageApi.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (planId: string) => {
    try {
      await apiRequest(`${API_BASE_URL}/plans/${planId}`, { method: 'DELETE' });
      messageApi.success('套餐已删除');
      void loadPlans();
    } catch {
      messageApi.error('删除失败');
    }
  };

  const columns = [
    { title: '排序', dataIndex: 'displayOrder', key: 'displayOrder', width: 60 },
    { title: '套餐名称', dataIndex: 'name', key: 'name' },
    {
      title: '价格',
      dataIndex: 'priceCents',
      key: 'priceCents',
      render: (v: number) => `¥${(v / 100).toFixed(2)}`,
    },
    { title: '最大实例数', dataIndex: 'maxInstances', key: 'maxInstances', width: 100 },
    { title: '允许规格', dataIndex: 'allowedSpecs', key: 'allowedSpecs', width: 100 },
    {
      title: '有效期',
      dataIndex: 'validityDays',
      key: 'validityDays',
      width: 100,
      render: (v: number | null) => (v ? `${v} 天` : '永久'),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (v: boolean) => (v ? <Tag color="green">上架</Tag> : <Tag>下架</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_: unknown, record: Plan) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除此套餐？" onConfirm={() => void handleDelete(record.id)} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard
        title="套餐管理"
        subtitle="管理平台的付费套餐，定义实例配额与价格"
        path="/platform/plans"
        permission="platform.settings.manage"
      />
      <Card extra={<Space><Button onClick={() => void loadPlans()}>刷新</Button><Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增套餐</Button></Space>}>
        <Table
          rowKey="id"
          dataSource={plans}
          columns={columns}
          loading={loading}
          pagination={false}
          size="middle"
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editingPlan ? '编辑套餐' : '新增套餐'}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSave()}
        confirmLoading={saving}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="套餐名称" rules={[{ required: true, message: '请输入套餐名称' }]}>
            <Input placeholder="例如：基础版" />
          </Form.Item>
          <Form.Item name="description" label="套餐描述">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
          <Form.Item name="price" label="价格（元）" rules={[{ required: true, message: '请输入价格' }]}>
            <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} placeholder="0.00" />
          </Form.Item>
          <Form.Item name="maxInstances" label="最大实例数" rules={[{ required: true }]}>
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="allowedSpecs" label="允许的规格" rules={[{ required: true }]} extra="逗号分隔，如 S,M,L">
            <Input placeholder="S" />
          </Form.Item>
          <Form.Item name="validityDays" label="有效期（天）" extra="留空表示永久有效">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="30" />
          </Form.Item>
          <Form.Item name="displayOrder" label="排序权重" extra="数字越小越靠前">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label="立即上架" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
