import { useState } from 'react';
import { Alert, Button, Card, Flex, Form, Input, Result, Space, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useSiteConfigStore } from '@/stores/site-config-store';

export function RegisterPage() {
  const siteSettings = useSiteConfigStore((state) => state.siteSettings);
  const authOptions = useSiteConfigStore((state) => state.authOptions);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ requiresVerification: boolean } | null>(null);

  const handleSubmit = async (values: { email: string; password: string; confirmPassword: string; displayName: string }) => {
    if (values.password !== values.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          displayName: values.displayName,
        }),
      });
      const result = await response.json() as { data?: { registered: boolean; requiresVerification: boolean }; error?: { message: string } };
      if (!response.ok) {
        throw new Error(result.error?.message || '注册失败');
      }
      setSuccess({ requiresVerification: result.data?.requiresVerification ?? false });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '注册失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authOptions.email.enabled || !authOptions.email.allowRegistration) {
    return (
      <Flex align='center' justify='center' style={{ minHeight: '100vh', padding: 24 }}>
        <Card style={{ width: 520 }}>
          <Result
            status='warning'
            title='注册功能未开放'
            subTitle='管理员尚未开放用户注册，请联系管理员获取账号。'
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
            title='注册成功'
            subTitle={
              success.requiresVerification
                ? '验证邮件已发送至您的邮箱，请查收并点击链接完成验证后再登录。'
                : '您的账号已创建成功，现在可以登录了。'
            }
            extra={<Link to='/login'><Button type='primary'>前往登录</Button></Link>}
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
            <Typography.Text type='secondary'>创建一个新账号</Typography.Text>
          </div>

          {error ? <Alert type='error' showIcon message={error} /> : null}

          <Form form={form} layout='vertical' onFinish={(values) => void handleSubmit(values)}>
            <Form.Item label='昵称' name='displayName' rules={[{ required: true, message: '请输入昵称' }]}>
              <Input placeholder='请输入昵称' autoComplete='name' />
            </Form.Item>
            <Form.Item label='邮箱' name='email' rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效的邮箱地址' }]}>
              <Input placeholder='请输入邮箱' autoComplete='email' />
            </Form.Item>
            <Form.Item label='密码' name='password' rules={[{ required: true, message: '请输入密码' }, { min: 8, message: '密码长度至少为 8 位' }]}>
              <Input.Password placeholder='请输入密码（至少 8 位）' autoComplete='new-password' />
            </Form.Item>
            <Form.Item label='确认密码' name='confirmPassword' rules={[{ required: true, message: '请再次输入密码' }]}>
              <Input.Password placeholder='请再次输入密码' autoComplete='new-password' />
            </Form.Item>
            <Button block size='large' type='primary' htmlType='submit' loading={submitting}>
              注册
            </Button>
          </Form>

          <Typography.Text type='secondary'>
            已有账号？<Link to='/login'>立即登录</Link>
          </Typography.Text>

          {siteSettings.footerText ? (
            <Typography.Text type='secondary'>
              {siteSettings.footerText}
            </Typography.Text>
          ) : null}
        </Space>
      </Card>
    </Flex>
  );
}
