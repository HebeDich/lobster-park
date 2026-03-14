import { Button, Space, Tag, Typography } from 'antd';

interface PagePlaceholderProps {
  title: string;
  route: string;
  description: string;
  requiredPermissions?: string[];
}

export function PagePlaceholder({ title, route, description, requiredPermissions = [] }: PagePlaceholderProps) {
  return (
    <div className="page-card">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        <Typography.Text type="secondary">{route}</Typography.Text>
        <Typography.Paragraph>{description}</Typography.Paragraph>
        <Space wrap>
          {requiredPermissions.map((permission) => (
            <Tag key={permission} color="blue">
              {permission}
            </Tag>
          ))}
        </Space>
        <Space>
          <Button type="primary">后续接入真实接口</Button>
          <Button>查看开发说明</Button>
        </Space>
      </Space>
    </div>
  );
}

