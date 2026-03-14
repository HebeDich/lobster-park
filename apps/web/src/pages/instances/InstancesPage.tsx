import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Input, message, Modal, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { CreateInstanceRequest, Instance } from '@/api/generated';
import { fetchInstancesData, peekInstancesData } from '@/utils/app-data';
import { getApiErrorMessage } from '@/utils/api-error';
import { useDebouncedValue } from '@/utils/use-debounced-value';
import { createIdempotencyKey } from '@/utils/idempotency';
import { getInstanceHealthStatusTag, getInstanceLifecycleStatusTag } from './instance-runtime-status';

const DEFAULT_INSTANCE_SPEC = 'S' as CreateInstanceRequest.specCode;
const DEFAULT_RUNTIME_VERSION = '2026.2.1';

export function InstancesPage() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Instance[]>(peekInstancesData({ pageNo: 1, pageSize: 20, keyword: '' }) ?? []);
  const [deleteTarget, setDeleteTarget] = useState<Instance | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [createForm] = Form.useForm();

  const load = async (nextKeyword?: string, force = false) => {
    setLoading(true);
    setError(null);
    try {
      const nextItems = await fetchInstancesData({ pageNo: 1, pageSize: 20, keyword: nextKeyword ?? keyword }, { force });
      setItems(nextItems);
    } catch (cause) {
      setError(getApiErrorMessage(cause, '加载实例失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(debouncedKeyword);
  }, [debouncedKeyword]);

  const openCreateModal = async () => {
    setCreateOpen(true);
  };

  const handleCreate = async (values: { name: string; description?: string }) => {
    setCreating(true);
    setError(null);
    try {
      const result = await DefaultService.createInstance(createIdempotencyKey(), {
        name: values.name,
        description: values.description,
        specCode: DEFAULT_INSTANCE_SPEC,
        runtimeVersion: DEFAULT_RUNTIME_VERSION,
        autoStart: true,
      });
      messageApi.success('实例创建任务已提交');
      setCreateOpen(false);
      createForm.resetFields();
      const instanceId = result.data?.instanceId;
      if (instanceId) {
        navigate(`/instances/${instanceId}/setup`);
      } else {
        await load(keyword, true);
      }
    } catch (cause) {
      setError(getApiErrorMessage(cause, '创建实例失败'));
    } finally {
      setCreating(false);
    }
  };

  const openDeleteModal = (target: Instance) => {
    setDeleteTarget(target);
    setDeleteConfirmText('');
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    setError(null);
    try {
      await DefaultService.deleteInstance(deleteTarget.id, { confirmText: deleteConfirmText.trim() });
      messageApi.success('实例 ' + (deleteTarget.name ?? deleteTarget.id) + ' 已删除');
      setDeleteTarget(null);
      setDeleteConfirmText('');
      await load(keyword, true);
    } catch (cause) {
      setError(getApiErrorMessage(cause, '删除实例失败'));
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnsType<Instance>>(
    () => [
      {
        title: '实例名称',
        dataIndex: 'name',
        key: 'name',
        render: (_value, record) => (
          <Button type="link" onClick={() => navigate(`/instances/${record.id}`)}>
            {record.name}
          </Button>
        ),
      },
      { title: '实例 ID', dataIndex: 'id', key: 'id' },
      {
        title: '生命周期',
        dataIndex: 'lifecycleStatus',
        key: 'lifecycleStatus',
        render: (value) => {
          const status = getInstanceLifecycleStatusTag(String(value ?? ''));
          return <Tag color={status.color}>{status.label}</Tag>;
        },
      },
      {
        title: '健康状态',
        key: 'healthStatus',
        render: (_value, record) => {
          const status = getInstanceHealthStatusTag({
            lifecycleStatus: record.lifecycleStatus,
            healthStatus: record.healthStatus,
          });
          return <Tag color={status.color}>{status.label}</Tag>;
        },
      },
      {
        title: '操作',
        key: 'actions',
        render: (_value, record) => (
          <Space>
            <Button size='small' onClick={() => navigate('/instances/' + record.id)}>查看</Button>
            <Button size='small' danger onClick={() => openDeleteModal(record)}>删除</Button>
          </Space>
        ),
      },
    ],
    [navigate],
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title="实例列表" subtitle="已接入后端实例列表接口" path="/instances" permission="instance.view" />
      <Space>
        <Input.Search allowClear placeholder="搜索实例名称" style={{ width: 320 }} value={keyword} onChange={(event) => setKeyword(event.target.value)} onSearch={(value) => void load(value, true)} />
        <Button onClick={() => void load(keyword, true)}>刷新</Button>
        <Button type="primary" onClick={() => void openCreateModal()}>新建实例</Button>
      </Space>
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Table rowKey="id" loading={loading} columns={columns} dataSource={items} pagination={false} />
      <Modal
        title='删除实例'
        open={Boolean(deleteTarget)}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
          setDeleteConfirmText('');
        }}
        onOk={() => void handleDelete()}
        okText='确认删除'
        okButtonProps={{ danger: true, disabled: deleteConfirmText.trim() !== 'DELETE' }}
        confirmLoading={deleting}
      >
        <Space direction='vertical' style={{ width: '100%' }} size='middle'>
          <Alert
            type='warning'
            showIcon
            message={'将删除实例 ' + (deleteTarget?.name ?? deleteTarget?.id ?? '')}
            description='这会触发运行时销毁，用于清理对应容器。请输入 DELETE 继续。'
          />
          <Input
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            placeholder='请输入 DELETE 确认'
          />
        </Space>
      </Modal>
      <Modal title="新建实例" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => void createForm.submit()} confirmLoading={creating}>
        <Form form={createForm} layout="vertical" onFinish={(values) => void handleCreate(values)}>
          <Form.Item name="name" label="实例名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
