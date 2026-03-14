import { useEffect, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Form, Input, List, Skeleton, Space, message } from 'antd';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { PlatformSetting } from '@/api/generated';
import { fetchPlatformSettingsData, invalidatePlatformSettingsData, peekPlatformSettingsData } from '@/utils/app-data';
import { useAuthStore } from '@/stores/auth-store';

export function PlatformSettingsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canManage = hasPermission('platform.settings.manage');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PlatformSetting[]>(peekPlatformSettingsData() ?? []);
  const [selected, setSelected] = useState<PlatformSetting | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [form] = Form.useForm();

  const load = async (force = false) => {
    let active = true;
    if (items.length === 0) setLoading(true);
    setError(null);
    try {
      const nextItems = await fetchPlatformSettingsData({ force });
      if (active) setItems(nextItems);
    } catch (cause) {
      if (active) setError(cause instanceof Error ? cause.message : '加载平台设置失败');
    } finally {
      if (active) setLoading(false);
    }
    return () => { active = false; };
  };

  useEffect(() => {
    void load();
  }, []);

  const openEdit = (item: PlatformSetting) => {
    setSelected(item);
    setJsonText(JSON.stringify(item.settingValueJson ?? null, null, 2));
    form.setFieldsValue({ description: item.description ?? '' });
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await form.validateFields();
      const parsed = JSON.parse(jsonText);
      await DefaultService.putPlatformSetting(selected.settingKey ?? '', { settingValueJson: parsed });
      invalidatePlatformSettingsData();
      messageApi.success('平台设置已保存');
      setSelected(null);
      await load(true);
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
        subtitle="已接入平台设置查询与编辑接口，可作为规格、版本策略和默认参数的管理入口"
        path="/platform/settings"
        permission={["platform.settings.view", "platform.settings.manage"]}
      />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Card extra={<Button onClick={() => void load(true)}>刷新</Button>}>
        {loading && items.length === 0 ? (
          <Skeleton active />
        ) : (
          <List
            dataSource={items}
            renderItem={(item) => (
              <List.Item actions={canManage ? [<Button key="edit" onClick={() => openEdit(item)}>编辑</Button>] : []}>
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
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} width={720} title={selected?.settingKey || '编辑平台设置'} extra={<Space><Button onClick={() => setSelected(null)}>取消</Button><Button type="primary" loading={saving} onClick={() => void save()}>保存</Button></Space>}>
        <Form form={form} layout="vertical">
          <Form.Item name="description" label="说明"><Input /></Form.Item>
          <Form.Item label="JSON 值" required>
            <Input.TextArea rows={18} value={jsonText} onChange={(event) => setJsonText(event.target.value)} spellCheck={false} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
