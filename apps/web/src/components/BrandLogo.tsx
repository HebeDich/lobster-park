import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import compactLogo from '@/assets/lobster-park-icon-display.png';
import brandLogo from '@/assets/lobster-park-logo-display.png';
import { useSiteConfigStore } from '@/stores/site-config-store';

type BrandLogoProps = {
  collapsed: boolean;
  onToggle: () => void;
  slogan?: string;
};

export function BrandLogo({
  collapsed,
  onToggle,
  slogan = '企业级 OpenClaw 控制平面',
}: BrandLogoProps) {
  const siteSettings = useSiteConfigStore((state) => state.siteSettings);
  const ariaLabel = collapsed ? '展开侧边栏' : '收起侧边栏';
  const resolvedSlogan = siteSettings.subtitle || slogan;
  const resolvedLogo = siteSettings.logoUrl || brandLogo;
  const resolvedCompactLogo = siteSettings.logoUrl || compactLogo;
  const resolvedTitle = siteSettings.title || '龙虾乐园';
  const resolvedTitleEn = siteSettings.titleEn || 'LOBSTER PARK';

  return (
    <div
      style={{
        padding: collapsed ? '16px 12px 12px' : '18px 16px 14px',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: collapsed ? 10 : 12,
        }}
      >
        <button
          type='button'
          onClick={onToggle}
          aria-label={ariaLabel}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            flex: collapsed ? 'none' : 1,
            width: collapsed ? '100%' : 'auto',
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          {collapsed ? (
            <img
              src={resolvedCompactLogo}
              alt={`${resolvedTitle} ${resolvedTitleEn}`}
              style={{
                display: 'block',
                width: 44,
                maxWidth: '100%',
                height: 'auto',
                objectFit: 'contain',
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minWidth: 0,
              }}
            >
              <img
                src={resolvedLogo}
                alt={`${resolvedTitle} ${resolvedTitleEn}`}
                style={{
                  display: 'block',
                  width: 52,
                  height: 52,
                  flex: 'none',
                  objectFit: 'contain',
                }}
              />
              <div style={{ minWidth: 0, textAlign: 'left' }}>
                <Typography.Text
                  strong
                  style={{
                    display: 'block',
                    fontSize: 20,
                    lineHeight: '24px',
                    color: 'rgba(15, 23, 42, 0.96)',
                  }}
                >
                  {resolvedTitle}
                </Typography.Text>
                <Typography.Text
                  style={{
                    display: 'block',
                    fontSize: 11,
                    letterSpacing: 0.8,
                    color: 'rgba(15, 23, 42, 0.78)',
                  }}
                >
                  {resolvedTitleEn}
                </Typography.Text>
              </div>
            </div>
          )}
        </button>
        <Button
          type='text'
          size='small'
          shape='circle'
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggle}
          aria-label={ariaLabel}
          style={{ color: '#595959', flex: 'none' }}
        />
      </div>
      {!collapsed ? (
        <Typography.Text
          type='secondary'
          style={{
            display: 'block',
            marginTop: 8,
            fontSize: 12,
            lineHeight: '20px',
          }}
        >
          {resolvedSlogan}
        </Typography.Text>
      ) : null}
    </div>
  );
}
