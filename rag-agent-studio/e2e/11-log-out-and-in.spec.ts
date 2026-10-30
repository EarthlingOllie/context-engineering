import { test, expect } from '@playwright/test';
import { createProject, logIn, logOut, newWorkspace, openProject, projectCard, registerWorkspace } from './helpers';

test('projects are still there after logging out and back in, and other workspaces stay private', async ({ page, browser }) => {
    const workspace = newWorkspace('Login');
    await registerWorkspace(page, workspace);
    await createProject(page, 'Private project');
    await openProject(page, 'Private project');
    const privateProjectUrl = page.url();

    await logOut(page);
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login$/);

    await logIn(page, workspace.email, 'not the password');
    await expect(page.getByText("We couldn't find an account with those details")).toBeVisible();

    await logIn(page, workspace.email, workspace.password);
    await expect(page).toHaveURL(/\/projects$/);
    await expect(projectCard(page, 'Private project')).toBeVisible();

    const stranger = await browser.newContext();
    const other = await stranger.newPage();
    await registerWorkspace(other, newWorkspace('Stranger'));

    const response = await other.goto(privateProjectUrl);
    expect(response?.status()).toBe(403);
    await expect(other.getByText('Private project')).toHaveCount(0);

    await stranger.close();
});
