import { useEffect, useState } from 'react';
import { Alert, Card, List, Tag } from 'antd';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { Role } from '@/api/generated';

export function TenantRolesPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Role[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await DefaultService.listRoles();
        setItems(response.data?.items ?? []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '加载角色失败');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeaderCard title="角色权限" subtitle="查看当前角色定义与权限集合" path="/tenant/roles" permission="tenant.manage" />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Card loading={loading}>
        <List
          dataSource={items}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={item.name ?? item.code}
                description={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{(item.permissions ?? []).map((permission) => <Tag key={permission}>{permission}</Tag>)}</div>}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}
