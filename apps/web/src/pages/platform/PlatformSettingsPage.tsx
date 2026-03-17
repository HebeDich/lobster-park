import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, List, Row, Select, Skeleton, Space, Switch, message } from 'antd';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { PlatformSetting } from '@/api/generated';
import { fetchPlatformSettingsData, invalidatePlatformSettingsData, peekPlatformSettingsData } from '@/utils/app-data';
import { useAuthStore } from '@/stores/auth-store';
import { useSiteConfigStore } from '@/stores/site-config-store';

const SITE_BRANDING_KEY = 'site_branding';
const EMAIL_AUTH_KEY = 'auth_email';
const LINUXDO_AUTH_KEY = 'auth_linuxdo';

type SettingsFormValues = {
  site: {
    title: string;
    titleEn: string;
    subtitle: string;
    description: string;
    logoUrl: string;
    faviconUrl: string;
    footerText: string;
  };
  email: {
    enabled: boolean;
    allowRegistration: boolean;
    requireEmailVerification: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    smtpFrom: string;
  };
  linuxdo: {
    enabled: boolean;
    issuerUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
  };
};

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readStringArray(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : fallback;
}

function buildInitialValues(items: PlatformSetting[]): SettingsFormValues {
  const site = asRecord(items.find((item) => item.settingKey === SITE_BRANDING_KEY)?.settingValueJson);
  const email = asRecord(items.find((item) => item.settingKey === EMAIL_AUTH_KEY)?.settingValueJson);
  const linuxdo = asRecord(items.find((item) => item.settingKey === LINUXDO_AUTH_KEY)?.settingValueJson);

  return {
    site: {
      title: readString(site.title, '龙虾乐园'),
      titleEn: readString(site.titleEn, 'LOBSTER PARK'),
      subtitle: readString(site.subtitle, '企业级 OpenClaw 控制平面'),
      description: readString(site.description, '集中管理实例、配置、节点与技能的 OpenClaw 平台'),
      logoUrl: readString(site.logoUrl, ''),
      faviconUrl: readString(site.faviconUrl, ''),
      footerText: readString(site.footerText, ''),
    },
    email: {
      enabled: readBoolean(email.enabled, true),
      allowRegistration: readBoolean(email.allowRegistration, false),
      requireEmailVerification: readBoolean(email.requireEmailVerification, false),
      smtpHost: readString(email.smtpHost, ''),
      smtpPort: readNumber(email.smtpPort, 465),
      smtpSecure: readBoolean(email.smtpSecure, true),
      smtpUser: readString(email.smtpUser, ''),
      smtpPassword: readString(email.smtpPassword, ''),
      smtpFrom: readString(email.smtpFrom, ''),
    },
    linuxdo: {
      enabled: readBoolean(linuxdo.enabled, false),
      issuerUrl: readString(linuxdo.issuerUrl, 'https://connect.linux.do'),
      clientId: readString(linuxdo.clientId, ''),
      clientSecret: readString(linuxdo.clientSecret, ''),
      redirectUri: readString(linuxdo.redirectUri, ''),
      scopes: readStringArray(linuxdo.scopes, ['openid', 'profile', 'email']),
    },
  };
}

export function PlatformSettingsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const loadPublicConfig = useSiteConfigStore((state) => state.loadPublicConfig);
  const canManage = hasPermission('platform.settings.manage');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PlatformSetting[]>(peekPlatformSettingsData() ?? []);
  const [selected, setSelected] = useState<PlatformSetting | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [form] = Form.useForm<SettingsFormValues>();

  const load = async (force = false) => {
    if (items.length === 0) setLoading(true);
    setError(null);
    try {
      const nextItems = await fetchPlatformSettingsData({ force });
      setItems(nextItems);
      form.setFieldsValue(buildInitialValues(nextItems));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载平台设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const otherItems = useMemo(
    () => items.filter((item) => ![SITE_BRANDING_KEY, EMAIL_AUTH_KEY, LINUXDO_AUTH_KEY].includes(item.settingKey ?? '')),
    [items],
  );

  const openEdit = (item: PlatformSetting) => {
    setSelected(item);
    setJsonText(JSON.stringify(item.settingValueJson ?? null, null, 2));
  };

  const saveStructuredSettings = async () => {
    setSaving(true);
    setError(null);
    try {
      const values = await form.validateFields();
      await Promise.all([
        DefaultService.putPlatformSetting(SITE_BRANDING_KEY, { settingValueJson: values.site }),
        DefaultService.putPlatformSetting(EMAIL_AUTH_KEY, { settingValueJson: values.email }),
        DefaultService.putPlatformSetting(LINUXDO_AUTH_KEY, { settingValueJson: values.linuxdo }),
      ]);
      invalidatePlatformSettingsData();
      await Promise.all([load(true), loadPublicConfig(true)]);
      messageApi.success('系统设置与登录方式已保存');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存系统设置失败');
    } finally {
      setSaving(false);
    }
  };

  const saveRawSetting = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const parsed = JSON.parse(jsonText);
      await DefaultService.putPlatformSetting(selected.settingKey ?? '', { settingValueJson: parsed });
      invalidatePlatformSettingsData();
      await Promise.all([load(true), loadPublicConfig(true)]);
      messageApi.success('高级配置项已保存');
      setSelected(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存平台设置失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard
        title="平台设置"
        subtitle="集中管理站点品牌、邮箱登录与 LinuxDo 登录配置，保存后会同步刷新登录页与后台品牌展示"
        path="/platform/settings"
        permission={["platform.settings.view", "platform.settings.manage"]}
      />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Card extra={<Space><Button onClick={() => void load(true)}>刷新</Button>{canManage ? <Button type="primary" loading={saving} onClick={() => void saveStructuredSettings()}>保存设置</Button> : null}</Space>}>
        {loading && items.length === 0 ? (
          <Skeleton active />
        ) : (
          <Form form={form} layout="vertical" disabled={!canManage}>
            <Row gutter={[16, 16]}>
              <Col xs={24} xl={12}>
                <Card title="站点品牌">
                  <Form.Item name={['site', 'title']} label="站点标题" rules={[{ required: true, message: '请输入站点标题' }]}>
                    <Input placeholder="例如：龙虾乐园" />
                  </Form.Item>
                  <Form.Item name={['site', 'titleEn']} label="英文标题">
                    <Input placeholder="例如：LOBSTER PARK" />
                  </Form.Item>
                  <Form.Item name={['site', 'subtitle']} label="副标题">
                    <Input placeholder="登录页与后台品牌说明文案" />
                  </Form.Item>
                  <Form.Item name={['site', 'description']} label="站点描述">
                    <Input.TextArea rows={4} />
                  </Form.Item>
                  <Form.Item name={['site', 'logoUrl']} label="Logo 地址">
                    <Input placeholder="可填写图片 URL" />
                  </Form.Item>
                  <Form.Item name={['site', 'faviconUrl']} label="Favicon 地址">
                    <Input placeholder="可填写站点图标 URL" />
                  </Form.Item>
                  <Form.Item name={['site', 'footerText']} label="页脚文案">
                    <Input placeholder="登录页底部展示文案" />
                  </Form.Item>
                </Card>
              </Col>
              <Col xs={24} xl={12}>
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Card title="邮箱登录">
                    <Form.Item name={['email', 'enabled']} label="启用邮箱登录" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item name={['email', 'allowRegistration']} label="允许用户注册" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item name={['email', 'requireEmailVerification']} label="注册需邮箱验证" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item name={['email', 'smtpHost']} label="SMTP 服务器" rules={[{ required: true, message: '请输入 SMTP 服务器地址' }]}>
                      <Input placeholder="smtp.example.com" />
                    </Form.Item>
                    <Form.Item name={['email', 'smtpPort']} label="SMTP 端口" rules={[{ required: true, message: '请输入端口号' }]}>
                      <InputNumber min={1} max={65535} style={{ width: '100%' }} placeholder="465" />
                    </Form.Item>
                    <Form.Item name={['email', 'smtpSecure']} label="使用 SSL/TLS" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item name={['email', 'smtpUser']} label="SMTP 用户名" rules={[{ required: true, message: '请输入 SMTP 用户名' }]}>
                      <Input placeholder="noreply@example.com" />
                    </Form.Item>
                    <Form.Item name={['email', 'smtpPassword']} label="SMTP 密码" extra="修改后才会更新，留空则保留原密码">
                      <Input.Password placeholder="请输入 SMTP 密码" />
                    </Form.Item>
                    <Form.Item name={['email', 'smtpFrom']} label="发件人" rules={[{ required: true, message: '请输入发件人地址' }]}>
                      <Input placeholder="Example <noreply@example.com>" />
                    </Form.Item>
                  </Card>
                  <Card title="LinuxDo 登录">
                    <Form.Item name={['linuxdo', 'enabled']} label="启用 LinuxDo 登录" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item name={['linuxdo', 'issuerUrl']} label="Issuer 地址">
                      <Input placeholder="https://connect.linux.do" />
                    </Form.Item>
                    <Form.Item name={['linuxdo', 'clientId']} label="Client ID">
                      <Input />
                    </Form.Item>
                    <Form.Item name={['linuxdo', 'clientSecret']} label="Client Secret">
                      <Input.Password />
                    </Form.Item>
                    <Form.Item name={['linuxdo', 'redirectUri']} label="回调地址">
                      <Input placeholder="例如：https://your-domain/api/v1/auth/linuxdo/callback" />
                    </Form.Item>
                    <Form.Item name={['linuxdo', 'scopes']} label="授权范围">
                      <Select mode="tags" tokenSeparators={[',', ' ']} placeholder="openid profile email" />
                    </Form.Item>
                  </Card>
                </Space>
              </Col>
            </Row>
          </Form>
        )}
      </Card>
      <Card title="其他配置项（高级）">
        {otherItems.length === 0 ? (
          <Alert type="info" showIcon message="暂无其他平台配置项" />
        ) : (
          <List
            dataSource={otherItems}
            renderItem={(item) => (
              <List.Item actions={canManage ? [<Button key="edit" onClick={() => openEdit(item)}>高级编辑</Button>] : []}>
                <Descriptions column={1} title={item.settingKey} size="small">
                  <Descriptions.Item label="说明">{item.description || '-'}</Descriptions.Item>
                  <Descriptions.Item label="值">
                    <pre style={{ margin: 0 }}>{JSON.stringify(item.settingValueJson, null, 2)}</pre>
                  </Descriptions.Item>
                </Descriptions>
              </List.Item>
            )}
          />
        )}
      </Card>
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} width={720} title={selected?.settingKey || '编辑平台设置'} extra={<Space><Button onClick={() => setSelected(null)}>取消</Button><Button type="primary" loading={saving} onClick={() => void saveRawSetting()}>保存</Button></Space>}>
        <Form layout="vertical">
          <Form.Item label="JSON 值" required>
            <Input.TextArea rows={18} value={jsonText} onChange={(event) => setJsonText(event.target.value)} spellCheck={false} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
