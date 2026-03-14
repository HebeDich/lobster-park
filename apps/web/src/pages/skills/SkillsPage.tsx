import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Row, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { Instance, Template } from '@/api/generated';

export function SkillsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [skills, setSkills] = useState<Array<Record<string, any>>>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [templateResponse, instanceResponse] = await Promise.all([
        DefaultService.listTemplates(),
        DefaultService.listInstances(1, 100),
      ]);
      const nextInstances = instanceResponse.data?.items ?? [];
      setInstances(nextInstances);
      const nextSelectedInstanceId = selectedInstanceId || nextInstances[0]?.id || '';
      setSelectedInstanceId(nextSelectedInstanceId);
      setTemplates(templateResponse.data?.items ?? []);
      if (nextSelectedInstanceId) {
        const skillsResponse = await DefaultService.listInstanceSkills(nextSelectedInstanceId);
        setSkills(skillsResponse.data?.items ?? []);
      } else {
        setSkills([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载技能中心失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const run = async () => {
      if (!selectedInstanceId) return;
      const response = await DefaultService.listInstanceSkills(selectedInstanceId);
      setSkills(response.data?.items ?? []);
    };
    void run();
  }, [selectedInstanceId]);

  const toggleSkill = async (skillId?: string, enabled = true) => {
    if (!skillId || !selectedInstanceId) return;
    if (enabled) {
      await DefaultService.enableSkill(selectedInstanceId, skillId);
      messageApi.success('技能已启用');
    } else {
      await DefaultService.disableSkill(selectedInstanceId, skillId);
      messageApi.success('技能已停用');
    }
    const response = await DefaultService.listInstanceSkills(selectedInstanceId);
    setSkills(response.data?.items ?? []);
  };

  const skillColumns: ColumnsType<Record<string, any>> = [
    { title: '技能 ID', dataIndex: 'id', key: 'id' },
    { title: '来源', dataIndex: 'sourceType', key: 'sourceType' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '审查状态', dataIndex: 'reviewStatus', key: 'reviewStatus', render: (value) => <Tag color="blue">{String(value)}</Tag> },
    { title: '风险', dataIndex: 'riskLevel', key: 'riskLevel', render: (value) => <Tag color="purple">{String(value)}</Tag> },
    { title: '实例状态', dataIndex: 'enabled', key: 'enabled', render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? '已启用' : '未启用'}</Tag> },
    { title: '操作', key: 'actions', render: (_value, record) => (<><Button size="small" onClick={() => void toggleSkill(record.id, true)}>启用</Button><Button size="small" onClick={() => void toggleSkill(record.id, false)} style={{ marginLeft: 8 }}>停用</Button></>) },
  ];

  const templateColumns: ColumnsType<Template> = [
    { title: '模板 ID', dataIndex: 'id', key: 'id' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'templateType', key: 'templateType' },
    { title: '规格', dataIndex: 'specCode', key: 'specCode' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (value) => <Tag color="green">{String(value)}</Tag> },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title="技能中心" subtitle="真实接入技能目录、实例启停状态与内置模板目录" path="/skills" permission="skill.view" />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Card>
        <Space wrap>
          <span>目标实例</span>
          <Select value={selectedInstanceId || undefined} onChange={setSelectedInstanceId} style={{ width: 320 }} options={instances.map((item) => ({ label: `${item.name} (${item.id})`, value: item.id }))} />
        </Space>
      </Card>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}><Card title="技能目录"><Table rowKey="id" columns={skillColumns} dataSource={skills} loading={loading} pagination={false} /></Card></Col>
        <Col xs={24} xl={10}><Card title="内置模板"><Table rowKey="id" columns={templateColumns} dataSource={templates} loading={loading} pagination={false} /></Card></Col>
      </Row>
    </div>
  );
}
