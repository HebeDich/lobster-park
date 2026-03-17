import { useState } from 'react';
import { Alert, Button, Card, Flex, Form, Input, Result, Space, Typography } from 'antd';
import { Link, useSearchParams } from 'react-router-dom';
import { useSiteConfigStore } from '@/stores/site-config-store';
import { API_BASE_URL, apiRequest } from '@/api/client';

export function ResetPasswordPage() {
  const siteSettings = useSiteConfigStore((state) => state.siteSettings);
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (values: { newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: values.newPassword }),
      });
      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '重置密码失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <Flex align='center' justify='center' style={{ minHeight: '100vh', padding: 24 }}>
        <Card style={{ width: 520 }}>
          <Result
            status='error'
            title='无效的重置链接'
            subTitle='缺少重置 token，请通过邮件中的链接访问此页面。'
            extra={<Link to='/login'><Button type='primary'>返回登录</Button></Link>}
          />
        </Card>
      </Flex>
    );
  }

  if (success) {
    return (
      <Flex align='center' justify='center' style={{ minHeight: '100vh', padding: 24 }}>
        <Card style={{ width: 520 }}>
          <Result
            status='success'
            title='密码重置成功'
            subTitle='您的密码已成功重置，现在可以使用新密码登录了。'
            extra={<Link to='/login'><Button type='primary'>去登录</Button></Link>}
          />
        </Card>
      </Flex>
    );
  }

  return (
    <Flex align='center' justify='center' style={{ minHeight: '100vh', padding: 24 }}>
      <Card style={{ width: 520 }}>
        <Space direction='vertical' size={20} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={2}>{siteSettings.title}</Typography.Title>
            <Typography.Text type='secondary'>
              请输入新密码。密码长度不少于 6 位。
            </Typography.Text>
          </div>

          {error ? <Alert type='error' showIcon message={error} /> : null}

          <Form form={form} layout='vertical' onFinish={(values) => void handleSubmit(values)}>
            <Form.Item
              label='新密码'
              name='newPassword'
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码长度不能少于 6 位' },
              ]}
            >
              <Input.Password placeholder='请输入新密码' autoComplete='new-password' />
            </Form.Item>
            <Form.Item
              label='确认密码'
              name='confirmPassword'
              rules={[
                { required: true, message: '请再次输入密码' },
              ]}
            >
              <Input.Password placeholder='请再次输入密码' autoComplete='new-password' />
            </Form.Item>
            <Button block size='large' type='primary' htmlType='submit' loading={submitting}>
              重置密码
            </Button>
          </Form>

          <Typography.Text type='secondary'>
            <Link to='/login'>返回登录</Link>
          </Typography.Text>
        </Space>
      </Card>
    </Flex>
  );
}
