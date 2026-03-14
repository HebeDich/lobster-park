import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useParams } from 'react-router-dom';
import { DefaultService } from '@/api';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { getApiErrorMessage } from '@/utils/api-error';

type SkillRecord = Record<string, any>;

function readMetadata(record: SkillRecord) {
  return record?.metadataJson && typeof record.metadataJson === 'object' ? record.metadataJson as Record<string, unknown> : {};
}

export function InstanceSkillsPage() {
  const { id = '' } = useParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [items, setItems] = useState<SkillRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await DefaultService.listInstanceSkills(id);
      setItems(response.data?.items ?? []);
    } catch (cause) {
      setError(getApiErrorMessage(cause, '加载实例技能失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const toggleSkill = async (record: SkillRecord, enabled: boolean) => {
    const skillId = String(record.id ?? '');
    if (!skillId) return;
    setTogglingId(skillId);
    setError(null);
    try {
      if (enabled) {
        await DefaultService.enableSkill(id, skillId);
      } else {
        await DefaultService.disableSkill(id, skillId);
      }
      messageApi.success(enabled ? '技能已启用到当前实例' : '技能已从当前实例停用');
      await load();
    } catch (cause) {
      setError(getApiErrorMessage(cause, enabled ? '启用技能失败' : '停用技能失败'));
    } finally {
      setTogglingId('');
    }
  };

  const columns = useMemo<ColumnsType<SkillRecord>>(() => [
    {
      title: '技能',
      key: 'name',
      render: (_value, record) => {
        const metadata = readMetadata(record);
        const name = typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name.trim() : String(record.id ?? '-');
        const description = typeof metadata.description === 'string' ? metadata.description.trim() : '';
        return (
          <Space direction='vertical' size={2}>
            <Typography.Text strong>{name}</Typography.Text>
            <Typography.Text type='secondary'>{description || '暂无说明'}</Typography.Text>
          </Space>
        );
      },
    },
    {
      title: '来源',
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 120,
      render: (value) => <Tag>{String(value || '-')}</Tag>,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 120,
      render: (value) => String(value || '-'),
    },
    {
      title: '风险',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 110,
      render: (value) => {
        const risk = String(value || 'unknown');
        const color = risk === 'low' ? 'green' : risk === 'medium' ? 'orange' : 'red';
        return <Tag color={color}>{risk}</Tag>;
      },
    },
    {
      title: '当前实例状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 140,
      render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? '已启用' : '未启用'}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_value, record) => {
        const enabled = Boolean(record.enabled);
        const skillId = String(record.id ?? '');
        return enabled ? (
          <Button danger size='small' loading={togglingId === skillId} onClick={() => void toggleSkill(record, false)}>
            停用
          </Button>
        ) : (
          <Button type='primary' size='small' loading={togglingId === skillId} onClick={() => void toggleSkill(record, true)}>
            启用
          </Button>
        );
      },
    },
  ], [id, togglingId]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard
        title='实例技能'
        subtitle='只管理当前实例的技能开关，不影响平台其他实例'
        path={`/instances/${id}/skills`}
        permission='skill.view'
        backTo={`/instances/${id}`}
        backLabel='返回实例概览'
      />
      {error ? <Alert type='error' showIcon message={error} /> : null}
      <Alert
        type='info'
        showIcon
        message='这里的启用/停用只作用于当前实例'
        description='全局技能中心仍然保留给管理员做技能目录与审核管理；实例用户只需要在这里决定本实例是否启用某个技能。'
      />
      <Card extra={<Button onClick={() => void load()} loading={loading}>刷新</Button>}>
        <Table rowKey='id' columns={columns} dataSource={items} loading={loading} pagination={false} />
      </Card>
    </div>
  );
}
