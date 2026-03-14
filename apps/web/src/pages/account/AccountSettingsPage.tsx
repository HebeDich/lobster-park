import { useState } from 'react';
import { Alert, Button, Card, Form, Input, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { DefaultService } from '@/api';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { useAuthStore } from '@/stores/auth-store';

export function AccountSettingsPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const logout = useAuthStore((state) => state.logout);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const handleSubmit = async (values: { oldPassword: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await DefaultService.changePassword({ oldPassword: values.oldPassword, newPassword: values.newPassword });
      try {
        await DefaultService.logoutSession();
      } catch {
      }
      logout();
      messageApi.success('密码已更新，请重新登录');
      navigate('/login');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '修改密码失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title='个人设置' subtitle='查看账号信息并修改登录密码' path='/account/settings' />
      {error ? <Alert type='error' showIcon message={error} /> : null}
      <Card title='账号信息'>
        <div>姓名：{currentUser?.name ?? '-'}</div>
        <div>邮箱：{currentUser?.email ?? '-'}</div>
        <div>角色：{currentUser?.roles.join(', ') ?? '-'}</div>
      </Card>
      <Card title='修改密码'>
        <Form form={form} layout='vertical' onFinish={(values) => void handleSubmit(values)}>
          <Form.Item label='旧密码' name='oldPassword' rules={[{ required: true, message: '请输入旧密码' }]}>
            <Input.Password placeholder='请输入旧密码' />
          </Form.Item>
          <Form.Item label='新密码' name='newPassword' rules={[{ required: true, message: '请输入新密码' }, { min: 8, message: '密码至少 8 位' }]}>
            <Input.Password placeholder='请输入新密码' />
          </Form.Item>
          <Form.Item label='确认新密码' name='confirmPassword' rules={[{ required: true, message: '请再次输入新密码' }]}>
            <Input.Password placeholder='请再次输入新密码' />
          </Form.Item>
          <Button type='primary' htmlType='submit' loading={submitting}>更新密码</Button>
        </Form>
      </Card>
    </div>
  );
}
