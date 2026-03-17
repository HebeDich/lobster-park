import { useState } from 'react';
import { Alert, Button, Card, Flex, Form, Input, Space, Typography } from 'antd';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { DefaultService } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useSiteConfigStore } from '@/stores/site-config-store';

export function LoginPage() {
  const hydrateFromApi = useAuthStore((state) => state.hydrateFromApi);
  const siteSettings = useSiteConfigStore((state) => state.siteSettings);
  const authOptions = useSiteConfigStore((state) => state.authOptions);
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const verified = searchParams.get('verified') === 'true';
  const verifyError = searchParams.get('verify_error');
  const authError = searchParams.get('auth_error');
  const from = (location.state as { from?: string } | null)?.from || '/workbench';

  const authErrorMessages: Record<string, string> = {
    linuxdo_unavailable: 'LinuxDo 登录未配置或未启用，请联系管理员。',
    state_expired: '登录请求已过期，请重新尝试。',
    token_exchange_failed: 'LinuxDo 登录授权失败，请重新尝试。',
    account_disabled: '账号已被禁用，请联系管理员。',
    linuxdo_login_failed: 'LinuxDo 登录失败，请重新尝试。',
    oidc_unavailable: 'SSO 登录未配置或未启用。',
  };

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

  const handleLinuxDoLogin = () => {
    const redirectUri = encodeURIComponent(from);
    window.location.href = `${authOptions.linuxdo.authorizeUrl}?redirect_uri=${redirectUri}`;
  };

  return (
    <Flex align='center' justify='center' style={{ minHeight: '100vh', padding: 24 }}>
      <Card style={{ width: 520 }}>
        <Space direction='vertical' size={20} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={2}>{siteSettings.title}</Typography.Title>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              {siteSettings.titleEn}
            </Typography.Text>
            <Typography.Text type='secondary'>
              {siteSettings.subtitle || '使用邮箱和密码登录平台。普通用户登录后只会看到自己的实例与数据。'}
            </Typography.Text>
          </div>

          {verified ? <Alert type='success' showIcon message='邮箱验证成功，现在可以登录了。' /> : null}
          {verifyError ? <Alert type='error' showIcon message='邮箱验证失败，链接可能已过期或无效。' /> : null}
          {authError ? <Alert type='error' showIcon message={authErrorMessages[authError] || `登录失败（${authError}）`} /> : null}
          {error ? <Alert type='error' showIcon message={error} /> : null}

          {authOptions.email.enabled ? (
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <Typography.Text type='secondary'>
                  <Link to='/forgot-password'>忘记密码？</Link>
                </Typography.Text>
                {authOptions.email.allowRegistration ? (
                  <Typography.Text type='secondary'>
                    还没有账号？<Link to='/register'>立即注册</Link>
                  </Typography.Text>
                ) : null}
              </div>
            </Form>
          ) : (
            <Alert type='info' showIcon message='当前未启用邮箱登录，请使用其他登录方式。' />
          )}

          {authOptions.linuxdo.enabled ? (
            <Button block size='large' onClick={handleLinuxDoLogin}>
              使用 LinuxDo 登录
            </Button>
          ) : null}

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
