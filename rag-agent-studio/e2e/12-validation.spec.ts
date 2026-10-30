import { test, expect } from '@playwright/test';
import { createAssistant, createProject, newWorkspace, projectCard, registerWorkspace } from './helpers';

test('empty names, bad emails and oversized files get plain-language messages', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Create workspace' }).click();
    await expect(page.getByText('Please enter a workspace name')).toBeVisible();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();

    const workspace = newWorkspace('Validation');
    await registerWorkspace(page, workspace);

    await page.getByRole('button', { name: 'New project' }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByText('Please give the project a name')).toBeVisible();

    await createProject(page, 'Validation project');
    await projectCard(page, 'Validation project').click();
    await page.getByRole('button', { name: 'New assistant' }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByText('Please give the assistant a name')).toBeVisible();

    await createAssistant(page, 'Validation project', 'Validation helper');
    await page.getByLabel('Name', { exact: true }).fill('');
    await page.getByLabel('Greeting').fill('');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Please give the assistant a name')).toBeVisible();
    await expect(page.getByText('Please add a greeting')).toBeVisible();

    await page.getByRole('link', { name: 'Knowledge' }).click();
    await page.getByRole('button', { name: 'Add text' }).click();
    await expect(page.getByText('Please paste some text')).toBeVisible();

    await page.getByLabel('Web address').fill('not a web address');
    await page.getByRole('button', { name: 'Add web page' }).click();
    await expect(page.getByText('Please enter a valid web address starting with http')).toBeVisible();

    // Nothing chosen yet: a different message from the size one, so the next check really proves the 10 MB rule.
    await page.getByRole('button', { name: 'Upload file' }).click();
    await expect(page.getByText('Please choose a file first')).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
        name: 'too-big.txt',
        mimeType: 'text/plain',
        buffer: Buffer.alloc(11 * 1024 * 1024, 'a'),
    });
    await expect(page.getByText('Please choose a PDF, Word, text or Markdown file under 10 MB')).toBeVisible();
    await expect(page.getByText('Chosen: too-big.txt')).toHaveCount(0);

    await page.getByRole('link', { name: 'Team' }).click();
    await page.getByLabel('Email').fill('not..an.email@example.com');
    await page.getByRole('button', { name: 'Invite' }).click();
    await expect(page.getByText('Please enter a valid email')).toBeVisible();

    await page.getByLabel('Email').fill(workspace.email);
    await page.getByRole('button', { name: 'Invite' }).click();
    await expect(page.getByText('That person is already in your workspace')).toBeVisible();
});
