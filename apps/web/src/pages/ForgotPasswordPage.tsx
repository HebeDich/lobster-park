import { useState } from 'react';
import { Alert, Button, Card, Flex, Form, Input, Result, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { useSiteConfigStore } from '@/stores/site-config-store';
import { API_BASE_URL, apiRequest } from '@/api/client';

export function ForgotPasswordPage() {
  const siteSettings = useSiteConfigStore((state) => state.siteSettings);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (values: { email: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      });
      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '发送重置邮件失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Flex align='center' justify='center' style={{ minHeight: '100vh', padding: 24 }}>
        <Card style={{ width: 520 }}>
          <Result
            status='success'
            title='重置邮件已发送'
            subTitle='如果该邮箱已注册，您将收到一封包含重置链接的邮件。请检查收件箱（包括垃圾邮件文件夹）。'
            extra={<Link to='/login'><Button type='primary'>返回登录</Button></Link>}
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
              输入您的注册邮箱，我们将发送密码重置链接到您的邮箱。
            </Typography.Text>
          </div>

          {error ? <Alert type='error' showIcon message={error} /> : null}

          <Form form={form} layout='vertical' onFinish={(values) => void handleSubmit(values)}>
            <Form.Item
              label='邮箱'
              name='email'
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input placeholder='请输入注册邮箱' autoComplete='email' />
            </Form.Item>
            <Button block size='large' type='primary' htmlType='submit' loading={submitting}>
              发送重置邮件
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
