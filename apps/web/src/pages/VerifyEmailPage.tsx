import { useEffect, useState } from 'react';
import { Button, Card, Flex, Result, Spin } from 'antd';
import { Link, useSearchParams } from 'react-router-dom';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('缺少验证 token，请检查链接是否完整。');
      return;
    }

    fetch(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      redirect: 'manual',
    })
      .then((response) => {
        if (response.ok || response.type === 'opaqueredirect' || response.status === 302) {
          setStatus('success');
        } else {
          return response.json().then((result: { error?: { message?: string } }) => {
            throw new Error(result.error?.message || '验证失败');
          });
        }
      })
      .catch((cause: unknown) => {
        setStatus('error');
        setErrorMsg(cause instanceof Error ? cause.message : '验证失败，链接可能已过期或无效。');
      });
  }, [token]);

  return (
    <Flex align='center' justify='center' style={{ minHeight: '100vh', padding: 24 }}>
      <Card style={{ width: 520 }}>
        {status === 'loading' ? (
          <Flex align='center' justify='center' style={{ padding: 48 }}>
            <Spin size='large' tip='正在验证邮箱...' />
          </Flex>
        ) : status === 'success' ? (
          <Result
            status='success'
            title='邮箱验证成功'
            subTitle='您的邮箱已验证成功，现在可以登录了。'
            extra={<Link to='/login'><Button type='primary'>前往登录</Button></Link>}
          />
        ) : (
          <Result
            status='error'
            title='验证失败'
            subTitle={errorMsg}
            extra={<Link to='/login'><Button type='primary'>返回登录</Button></Link>}
          />
        )}
      </Card>
    </Flex>
  );
}
