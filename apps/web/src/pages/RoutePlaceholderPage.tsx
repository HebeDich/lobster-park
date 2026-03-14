import { Alert, Col, List, Row, Space, Typography } from 'antd';
import { useLocation } from 'react-router-dom';
import { PageHeaderCard } from '@/components/PageHeaderCard';

type RoutePlaceholderPageProps = {
  title: string;
  subtitle: string;
  path: string;
  permission?: string | string[];
  bullets?: string[];
};

export function RoutePlaceholderPage({
  title,
  subtitle,
  path,
  permission,
  bullets = [],
}: RoutePlaceholderPageProps) {
  const location = useLocation();

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard title={title} subtitle={subtitle} path={path} permission={permission} />
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Alert
            type="info"
            showIcon
            message="页面骨架已就位"
            description={`当前路由：${location.pathname}。后续将在此接入真实 API、表单、表格、图表与实时事件。`}
          />
        </Col>
        <Col span={24}>
          <List
            bordered
            header={<Typography.Text strong>后续实现要点</Typography.Text>}
            dataSource={
              bullets.length > 0
                ? bullets
                : ['接入 OpenAPI 生成客户端', '补充页面级状态与异常处理', '连接真实权限与接口数据']
            }
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        </Col>
      </Row>
    </Space>
  );
}
