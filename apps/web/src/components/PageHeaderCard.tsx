import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Card, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

type PageHeaderCardProps = {
  title: string;
  subtitle: string;
  path: string;
  permission?: string | string[];
  backTo?: string;
  backLabel?: string;
};

export function PageHeaderCard({ title, subtitle, path, permission, backTo, backLabel }: PageHeaderCardProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {backTo ? (
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(backTo)}
            style={{ paddingInline: 0, alignSelf: 'flex-start' }}
          >
            {backLabel ?? '返回'}
          </Button>
        ) : null}
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        <Typography.Text type="secondary">{subtitle}</Typography.Text>
        <Space wrap>
          <Tag color="blue">{path}</Tag>
          {permission ? (
            <Tag color="purple">
              {Array.isArray(permission) ? permission.join(' / ') : permission}
            </Tag>
          ) : null}
        </Space>
      </Space>
    </Card>
  );
}
