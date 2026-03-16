import { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Upload, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import {
  listSkillsAdmin,
  getSkillAdmin,
  createSkill,
  updateSkill,
  deleteSkill,
  uploadSkillPackage,
} from '@/api/skill-admin-api';
import type { SkillPackageAdmin, CreateSkillRequest, UpdateSkillRequest } from '@/api/skill-admin-api';

export function SkillManagePage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [skills, setSkills] = useState<SkillPackageAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 创建/编辑弹窗
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillPackageAdmin | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // 详情弹窗
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSkill, setDetailSkill] = useState<SkillPackageAdmin | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ZIP 上传弹窗
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listSkillsAdmin();
      setSkills(response.data?.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载技能列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleCreate = () => {
    setEditingSkill(null);
    form.resetFields();
    form.setFieldsValue({ version: '1.0.0', sourceType: 'custom', riskLevel: 'low' });
    setModalOpen(true);
  };

  const handleEdit = async (record: SkillPackageAdmin) => {
    setEditingSkill(record);
    const meta = record.metadataJson ?? {};
    form.resetFields();
    form.setFieldsValue({
      name: (meta as Record<string, unknown>).name ?? '',
      description: (meta as Record<string, unknown>).description ?? '',
      version: record.version,
      sourceType: record.sourceType,
      riskLevel: record.riskLevel,
      contentJsonStr: '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      let contentJson: unknown = undefined;
      if (values.contentJsonStr?.trim()) {
        try {
          contentJson = JSON.parse(values.contentJsonStr);
        } catch {
          messageApi.error('contentJson 格式不正确，请输入合法的 JSON');
          setSubmitting(false);
          return;
        }
      }

      if (editingSkill) {
        const body: UpdateSkillRequest = {
          name: values.name,
          description: values.description,
          version: values.version,
          riskLevel: values.riskLevel,
        };
        if (contentJson !== undefined) body.contentJson = contentJson;
        await updateSkill(editingSkill.id, body);
        messageApi.success('技能已更新');
      } else {
        const body: CreateSkillRequest = {
          name: values.name,
          description: values.description,
          version: values.version,
          sourceType: values.sourceType,
          riskLevel: values.riskLevel,
        };
        if (contentJson !== undefined) body.contentJson = contentJson;
        await createSkill(body);
        messageApi.success('技能已创建');
      }

      setModalOpen(false);
      void load();
    } catch (cause) {
      if (cause instanceof Error) messageApi.error(cause.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (skillId: string) => {
    try {
      await deleteSkill(skillId);
      messageApi.success('技能已删除');
      void load();
    } catch (cause) {
      messageApi.error(cause instanceof Error ? cause.message : '删除失败');
    }
  };

  const handleViewDetail = async (skillId: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const response = await getSkillAdmin(skillId);
      setDetailSkill(response.data);
    } catch (cause) {
      messageApi.error(cause instanceof Error ? cause.message : '加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await uploadSkillPackage(file);
      messageApi.success('ZIP 技能包上传成功');
      setUploadOpen(false);
      void load();
    } catch (cause) {
      messageApi.error(cause instanceof Error ? cause.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const columns: ColumnsType<SkillPackageAdmin> = [
    {
      title: '技能名称',
      key: 'name',
      render: (_v, record) => {
        const meta = (record.metadataJson ?? {}) as Record<string, unknown>;
        return (
          <a onClick={() => void handleViewDetail(record.id)}>
            {String(meta.name ?? record.id)}
          </a>
        );
      },
    },
    { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true },
    { title: '来源', dataIndex: 'sourceType', key: 'sourceType', render: (v) => <Tag>{String(v)}</Tag> },
    { title: '版本', dataIndex: 'version', key: 'version' },
    {
      title: '审查状态',
      dataIndex: 'reviewStatus',
      key: 'reviewStatus',
      render: (v) => <Tag color={v === 'approved' ? 'green' : 'orange'}>{String(v)}</Tag>,
    },
    {
      title: '风险',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (v) => <Tag color={v === 'low' ? 'blue' : v === 'high' ? 'red' : 'orange'}>{String(v)}</Tag>,
    },
    {
      title: '内容',
      key: 'hasContent',
      render: (_v, record) => (
        <Space>
          {record.hasContent ? <Tag color="green">有内容</Tag> : <Tag>无内容</Tag>}
          {record.hasStoragePath ? <Tag color="cyan">有文件</Tag> : null}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_v, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => void handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该技能？" onConfirm={() => void handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title="技能管理" subtitle="管理平台内置技能，支持表单创建和 ZIP 包上传" path="/platform/skills" permission="skill.manage" />
      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Card
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>创建技能</Button>
            <Button icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>上传 ZIP 包</Button>
          </Space>
        }
      >
        <Table rowKey="id" columns={columns} dataSource={skills} loading={loading} pagination={false} />
      </Card>

      {/* 创建/编辑弹窗 */}
      <Modal
        open={modalOpen}
        title={editingSkill ? '编辑技能' : '创建技能'}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="技能名称" rules={[{ required: true, message: '请输入技能名称' }]}>
            <Input placeholder="例如：知识库检索助手" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="技能描述" />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="1.0.0" />
          </Form.Item>
          {!editingSkill && (
            <Form.Item name="sourceType" label="来源类型">
              <Select options={[{ label: '自定义', value: 'custom' }, { label: '内置', value: 'builtin' }, { label: '包', value: 'package' }]} />
            </Form.Item>
          )}
          <Form.Item name="riskLevel" label="风险等级">
            <Select options={[{ label: '低', value: 'low' }, { label: '中', value: 'medium' }, { label: '高', value: 'high' }]} />
          </Form.Item>
          <Form.Item name="contentJsonStr" label="技能内容 (JSON)" extra="可选。输入 Skill 的内容定义 JSON（如 systemPromptAppend、tools 等）">
            <Input.TextArea rows={8} placeholder='{"type":"agent_enhancement","systemPromptAppend":"...","tools":[]}' />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        open={detailOpen}
        title="技能详情"
        onCancel={() => { setDetailOpen(false); setDetailSkill(null); }}
        footer={<Button onClick={() => { setDetailOpen(false); setDetailSkill(null); }}>关闭</Button>}
        width={720}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>加载中...</div>
        ) : detailSkill ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div><strong>ID:</strong> {detailSkill.id}</div>
            <div><strong>名称:</strong> {String((detailSkill.metadataJson as Record<string, unknown>)?.name ?? '-')}</div>
            <div><strong>描述:</strong> {String((detailSkill.metadataJson as Record<string, unknown>)?.description ?? '-')}</div>
            <div><strong>来源:</strong> {detailSkill.sourceType} / {detailSkill.sourceUri}</div>
            <div><strong>版本:</strong> {detailSkill.version}</div>
            <div><strong>审查状态:</strong> <Tag color={detailSkill.reviewStatus === 'approved' ? 'green' : 'orange'}>{detailSkill.reviewStatus}</Tag></div>
            <div><strong>风险:</strong> <Tag color={detailSkill.riskLevel === 'low' ? 'blue' : 'red'}>{detailSkill.riskLevel}</Tag></div>
            <div>
              <strong>技能内容 (contentJson):</strong>
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, maxHeight: 300, overflow: 'auto', marginTop: 8, fontSize: 12 }}>
                {detailSkill.contentJson ? JSON.stringify(detailSkill.contentJson, null, 2) : '(无内容)'}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ZIP 上传弹窗 */}
      <Modal
        open={uploadOpen}
        title="上传 ZIP 技能包"
        onCancel={() => setUploadOpen(false)}
        footer={null}
        destroyOnClose
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <Alert type="info" showIcon message="ZIP 包根目录必须包含 skill.json 文件，定义技能的名称、版本和入口等信息。" />
          <Upload.Dragger
            accept=".zip"
            maxCount={1}
            beforeUpload={(file) => {
              void handleUpload(file);
              return false;
            }}
            showUploadList={false}
            disabled={uploading}
          >
            <p style={{ fontSize: 48, color: '#1890ff' }}><UploadOutlined /></p>
            <p>{uploading ? '上传中...' : '点击或拖拽 ZIP 文件到此处'}</p>
          </Upload.Dragger>
        </div>
      </Modal>
    </div>
  );
}
