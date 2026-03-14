import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, List, Row, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useParams } from 'react-router-dom';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { SecretListItem } from '@/api/generated';
import { DeleteSecretRequest } from '@/api/generated';

function randomKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `req_${Date.now()}`;
}

export function ConfigCenterPage() {
  const { id = '' } = useParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [draftJson, setDraftJson] = useState('');
  const [currentJson, setCurrentJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<SecretListItem[]>([]);
  const [secretForm] = Form.useForm();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [draftResponse, currentResponse, secretResponse] = await Promise.all([
        DefaultService.getConfigDraft(id),
        DefaultService.getCurrentConfig(id),
        DefaultService.listInstanceSecrets(id),
      ]);
      setDraftJson(JSON.stringify(draftResponse.data?.draftJson ?? {}, null, 2));
      const currentPayload = (currentResponse.data as unknown as { configJson?: unknown; normalizedConfigJson?: unknown }) ?? {};
      setCurrentJson(JSON.stringify(currentPayload.configJson ?? currentPayload.normalizedConfigJson ?? {}, null, 2));
      setSecrets(secretResponse.data?.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载配置中心失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const parsed = JSON.parse(draftJson);
      await DefaultService.saveConfigDraft(id, { draftJson: parsed });
      messageApi.success('草稿已保存');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存草稿失败');
    } finally {
      setSaving(false);
    }
  };

  const fetchJobStatus = async (jobId?: string) => {
    if (!jobId) return;
    const job = await DefaultService.getJob(jobId);
    if (job.data?.jobStatus === 'failed') {
      setValidationStatus(job.data.errorMessage ?? '校验失败');
      throw new Error(job.data.errorMessage ?? '操作失败');
    }
    setValidationStatus(job.data?.jobStatus ?? 'success');
  };

  const handleValidate = async () => {
    setValidating(true);
    setError(null);
    try {
      const parsed = JSON.parse(draftJson);
      await DefaultService.saveConfigDraft(id, { draftJson: parsed });
      const result = await DefaultService.validateConfig(id, randomKey());
      await fetchJobStatus(result.data?.jobId);
      messageApi.success('配置校验通过');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '配置校验失败');
    } finally {
      setValidating(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const parsed = JSON.parse(draftJson);
      await DefaultService.saveConfigDraft(id, { draftJson: parsed });
      const result = await DefaultService.publishConfig(id, randomKey(), { note: 'publish from ui', confirmText: 'PUBLISH' });
      await fetchJobStatus(result.data?.jobId);
      messageApi.success('配置已发布');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '发布失败');
    } finally {
      setPublishing(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await DefaultService.exportConfigDraft(id);
      const blob = new Blob([JSON.stringify(response.data ?? {}, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${id}-config-draft.json`;
      link.click();
      window.URL.revokeObjectURL(url);
      messageApi.success('配置已导出');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '导出失败');
    }
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      const draftJson = parsed.draftJson ?? parsed.configJson ?? parsed;
      await DefaultService.importConfigDraft(id, { draftJson });
      messageApi.success('配置已导入到草稿');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '导入失败');
    } finally {
      event.target.value = '';
    }
  };

  const handleCreateSecret = async (values: { secretKey: string; secretValue: string; expiresAt?: string }) => {
    try {
      await DefaultService.createInstanceSecret(id, values);
      secretForm.resetFields();
      messageApi.success('密钥已创建');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '创建密钥失败');
    }
  };

  const handleDeleteSecret = async (secretKey: string) => {
    try {
      await DefaultService.deleteInstanceSecret(id, secretKey, { confirmText: DeleteSecretRequest.confirmText.DELETE });
      messageApi.success('密钥已删除');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除密钥失败');
    }
  };

  const secretColumns = useMemo<ColumnsType<SecretListItem>>(
    () => [
      { title: 'secretKey', dataIndex: 'secretKey', key: 'secretKey' },
      { title: '预览', dataIndex: 'maskedPreview', key: 'maskedPreview' },
      { title: '版本', dataIndex: 'secretVersion', key: 'secretVersion' },
      {
        title: '操作',
        key: 'actions',
        render: (_value, record) => (
          <Button danger size="small" onClick={() => void handleDeleteSecret(record.secretKey ?? '')}>
            删除
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title="配置中心" subtitle="真实接入 draft/current/validate/publish/secrets" path={`/instances/${id}/config`} permission={['config.view', 'config.edit']} backTo={`/instances/${id}`} backLabel='返回实例概览' />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {validationStatus ? <Alert type="info" showIcon message={`最近一次校验/发布状态：${validationStatus}`} /> : null}
      <input ref={importInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(event) => void handleImportFile(event)} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="草稿 JSON" extra={<Space><Button onClick={() => void handleExport()}>导出</Button><Button onClick={handleImportClick}>导入</Button><Button loading={saving} onClick={() => void handleSaveDraft()}>保存草稿</Button><Button loading={validating} onClick={() => void handleValidate()}>校验</Button><Button type="primary" loading={publishing} onClick={() => void handlePublish()}>发布</Button></Space>}>
            <Input.TextArea rows={22} value={draftJson} onChange={(event) => setDraftJson(event.target.value)} spellCheck={false} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="当前生效配置">
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{currentJson || '{}'}</pre>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="新增密钥">
            <Form layout="vertical" form={secretForm} onFinish={(values) => void handleCreateSecret(values)}>
              <Form.Item name="secretKey" label="secretKey" rules={[{ required: true }]}>
                <Input placeholder="openai_api_key" />
              </Form.Item>
              <Form.Item name="secretValue" label="secretValue" rules={[{ required: true }]}>
                <Input.Password placeholder="sk-..." />
              </Form.Item>
              <Form.Item name="expiresAt" label="expiresAt">
                <Input placeholder="2026-12-01T00:00:00Z" />
              </Form.Item>
              <Button htmlType="submit" type="primary">创建密钥</Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="密钥列表" extra={loading ? <Tag color="processing">同步中</Tag> : null}>
            <Table rowKey="secretKey" columns={secretColumns} dataSource={secrets} pagination={false} />
          </Card>
        </Col>
      </Row>
      <Card title="提示">
        <List
          dataSource={[
            '发布前会自动读取最新草稿；如果 JSON 非法会直接报错。',
            '配置中引用 apiKeyRef 时，必须先在右侧创建对应 secretKey。',
            '当前阶段以 Raw JSON 为主，结构化表单留到后续阶段。',
          ]}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
      </Card>
    </div>
  );
}
