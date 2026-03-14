import { useState } from 'react';
import { Alert, Button, Card, Flex, Form, Input, Space, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { DefaultService } from '@/api';
import { useAuthStore } from '@/stores/auth-store';

export function LoginPage() {
  const hydrateFromApi = useAuthStore((state) => state.hydrateFromApi);
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from = (location.state as { from?: string } | null)?.from || '/workbench';

  const handleSubmit = async (values: { email: string; password: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      await DefaultService.loginWithPassword({ email: values.email, password: values.password });
      const response = await DefaultService.getCurrentUser();
      if (!response.data) {
        throw new Error('登录成功，但未获取到当前用户信息');
      }
      hydrateFromApi({
        id: response.data.userId ?? '',
        name: response.data.displayName ?? '',
        email: response.data.email,
        tenantId: response.data.tenantId ?? '',
        roles: ((response.data.roles as Array<'platform_admin' | 'tenant_admin' | 'employee' | 'auditor'> | undefined) ?? []),
        permissions: response.data.permissions ?? [],
      });
      navigate(from);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flex align='center' justify='center' style={{ minHeight: '100vh', padding: 24 }}>
      <Card style={{ width: 520 }}>
        <Space direction='vertical' size={20} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={2}>Lobster Park</Typography.Title>
            <Typography.Text type='secondary'>
              使用邮箱和密码登录平台。普通用户登录后只会看到自己的实例与数据。
            </Typography.Text>
          </div>

          {error ? <Alert type='error' showIcon message={error} /> : null}

          <Form form={form} layout='vertical' onFinish={(values) => void handleSubmit(values)}>
            <Form.Item label='邮箱' name='email' rules={[{ required: true, message: '请输入邮箱' }]}>
              <Input placeholder='请输入邮箱' autoComplete='email' />
            </Form.Item>
            <Form.Item label='密码' name='password' rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password placeholder='请输入密码' autoComplete='current-password' />
            </Form.Item>
            <Button block size='large' type='primary' htmlType='submit' loading={submitting}>
              登录
            </Button>
          </Form>
        </Space>
      </Card>
    </Flex>
  );
}
