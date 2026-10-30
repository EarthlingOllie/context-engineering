import { test, expect } from '@playwright/test';
import { newWorkspace, registerWorkspace } from './helpers';

test('a new person creates a workspace and lands on an empty projects page', async ({ page }) => {
    const workspace = newWorkspace('Register');

    await registerWorkspace(page, workspace);

    await expect(page.getByText('Create your first project to start building assistants.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Team' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
});
