import { expect, test } from '@playwright/test';

test('platform admin can access core pages', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: '使用平台管理员进入工作台' }).click();
  await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible();

  await page.goto('/instances');
  await expect(page.getByRole('heading', { name: '实例列表' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Demo Instance', exact: true })).toBeVisible();

  await page.goto('/platform/settings');
  await expect(page.getByRole('heading', { name: '平台设置' })).toBeVisible();
  await expect(page.getByText('resource_specs')).toBeVisible();

  await page.goto('/jobs');
  await expect(page.getByRole('heading', { name: '任务中心' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'publish_config' }).first()).toBeVisible();

  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: '通知中心' })).toBeVisible();
});

test('employee sees owner-only instance scope', async ({ page }) => {
  await page.goto('/login');
  await page.getByText('普通员工').click();
  await expect(page).toHaveURL(/workbench/);
  await page.goto('/instances');
  await expect(page.getByRole('button', { name: 'Employee Demo Instance', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Demo Instance', exact: true })).toHaveCount(0);
});

test('config flow pages load and alerts page works', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: '使用平台管理员进入工作台' }).click();

  await page.goto('/instances/ins_demo/config');
  await expect(page.getByRole('heading', { name: '配置中心' })).toBeVisible();
  await expect(page.getByText('密钥列表')).toBeVisible();

  await page.goto('/instances/ins_demo/versions');
  await expect(page.getByRole('heading', { name: '配置版本' })).toBeVisible();

  await page.goto('/alerts');
  await expect(page.getByRole('heading', { name: '告警中心' })).toBeVisible();
  await expect(page.getByText('Demo channel probe failed')).toBeVisible();
});

test('openclaw primary-path pages load for platform admin', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: '使用平台管理员进入工作台' }).click();

  await page.goto('/instances/ins_demo/openclaw/basic-config');
  await expect(page.getByRole('heading', { name: '基础配置' })).toBeVisible();
  await page.getByLabel('名称').fill('Demo Instance E2E');
  await page.getByRole('button', { name: '保存到草稿' }).click();
  await expect(page.getByText('基础配置已保存到草稿')).toBeVisible();

  await page.goto('/instances/ins_demo/openclaw/channels');
  await expect(page.getByRole('heading', { name: '渠道接入' })).toBeVisible();
  await expect(page.getByText('Telegram')).toBeVisible();
  await expect(page.getByText('onboarding: bot_token')).toBeVisible();

  await page.goto('/instances/ins_demo/openclaw/console');
  await expect(page.getByRole('heading', { name: '实例调试台' })).toBeVisible();
  await page.getByPlaceholder('输入要调试的消息').fill('hello from playwright');
  await page.getByRole('button', { name: '执行 WebChat' }).click();
  await expect(page.getByText('最近一次 WebChat 结果')).toBeVisible();
  await expect(page.getByText('executionMode')).toBeVisible();

  await page.goto('/instances/ins_demo/openclaw/pairing');
  await expect(page.getByRole('heading', { name: '配对请求' })).toBeVisible();
});


test('enterprise sso login works with mock oidc', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: '使用企业 SSO 登录' }).click();
  await expect(page).toHaveURL(/workbench/);
  await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible();
});
