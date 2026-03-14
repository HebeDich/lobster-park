import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Form, Input, Select, Space, Switch, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import type { Role, User } from '@/api/generated';

const PRODUCT_ROLE_OPTIONS = [
  { label: '平台超管', value: 'platform_admin' },
  { label: '普通用户', value: 'employee' },
];

function getErrorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error && cause.message) {
    return cause.message;
  }
  return fallback;
}

export function TenantUsersPage() {
  const tenantId = useAuthStore((state) => state.currentUser?.tenantId ?? 'tnt_default');
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form] = Form.useForm();

  const roleOptions = useMemo(() => {
    if (!roles.length) return PRODUCT_ROLE_OPTIONS;
    const allowed = new Set(PRODUCT_ROLE_OPTIONS.map((item) => item.value));
    return roles
      .filter((role) => role.code && allowed.has(role.code))
      .map((role) => ({ label: role.code === 'platform_admin' ? '平台超管' : '普通用户', value: role.code ?? '' }));
  }, [roles]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersResponse, rolesResponse] = await Promise.all([
        DefaultService.listTenantUsers(tenantId),
        DefaultService.listRoles(),
      ]);
      setItems(usersResponse.data?.items ?? []);
      setRoles(rolesResponse.data?.items ?? []);
    } catch (cause) {
      setError(getErrorMessage(cause, '加载租户用户失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [tenantId]);

  const handleCreate = async (values: { email: string; displayName: string; initialPassword: string; roleCodes: string[] }) => {
    setError(null);
    try {
      await DefaultService.createTenantUser(tenantId, values);
      form.resetFields();
      messageApi.success('用户已创建');
      await load();
    } catch (cause) {
      const nextError = getErrorMessage(cause, '创建用户失败');
      setError(nextError);
      messageApi.error(nextError);
    }
  };

  const assignRole = async (userId?: string, nextRoles: string[] = []) => {
    if (!userId) return;
    setError(null);
    try {
      await DefaultService.assignUserRoles(userId, { roleCodes: nextRoles });
      messageApi.success('角色已更新');
      await load();
    } catch (cause) {
      const nextError = getErrorMessage(cause, '角色更新失败');
      setError(nextError);
      messageApi.error(nextError);
    }
  };

  const updateStatus = async (record: User, enabled: boolean) => {
    if (!record.id) return;
    setError(null);
    try {
      await DefaultService.patchTenantUser(tenantId, record.id, { status: enabled ? 'active' : 'disabled' });
      messageApi.success(enabled ? '用户已启用' : '用户已禁用');
      await load();
    } catch (cause) {
      const nextError = getErrorMessage(cause, enabled ? '启用用户失败' : '禁用用户失败');
      setError(nextError);
      messageApi.error(nextError);
    }
  };

  const resetPassword = async (record: User) => {
    if (!record.id) return;
    const password = window.prompt('请输入新的密码（至少 8 位）');
    if (!password) return;
    setError(null);
    try {
      await DefaultService.resetUserPassword(record.id, { password });
      messageApi.success('密码已重置');
    } catch (cause) {
      const nextError = getErrorMessage(cause, '重置密码失败');
      setError(nextError);
      messageApi.error(nextError);
    }
  };

  const columns: ColumnsType<User> = [
    { title: '用户 ID', dataIndex: 'id', key: 'id' },
    { title: '姓名', dataIndex: 'displayName', key: 'displayName' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (value) => <Tag color={value === 'active' ? 'green' : 'orange'}>{String(value)}</Tag> },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (value, record) => (
        <Select
          mode='multiple'
          style={{ minWidth: 180 }}
          value={value ?? []}
          options={roleOptions}
          onChange={(next) => void assignRole(record.id, next)}
        />
      ),
    },
    {
      title: '启用',
      key: 'enabled',
      render: (_, record) => (
        <Switch checked={record.status === 'active'} onChange={(checked) => void updateStatus(record, checked)} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button onClick={() => void resetPassword(record)}>重置密码</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title='用户管理' subtitle='创建真实用户、设置初始密码，并管理启停与角色' path='/tenant/users' permission='user.manage' />
      {error ? <Alert type='error' showIcon message={error} /> : null}
      <Card title='新增用户'>
        <Form form={form} layout='inline' onFinish={(values) => void handleCreate(values)}>
          <Form.Item name='displayName' rules={[{ required: true, message: '请输入姓名' }]}><Input placeholder='姓名' /></Form.Item>
          <Form.Item name='email' rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效邮箱' }]}><Input placeholder='邮箱' /></Form.Item>
          <Form.Item name='initialPassword' rules={[{ required: true, message: '请输入初始密码' }, { min: 8, message: '密码至少 8 位' }]}><Input.Password placeholder='初始密码' /></Form.Item>
          <Form.Item name='roleCodes' initialValue={['employee']}><Select mode='multiple' style={{ minWidth: 180 }} options={roleOptions} /></Form.Item>
          <Form.Item><Button type='primary' htmlType='submit'>创建</Button></Form.Item>
        </Form>
      </Card>
      <Card><Table rowKey='id' columns={columns} dataSource={items} loading={loading} pagination={false} /></Card>
    </div>
  );
}
