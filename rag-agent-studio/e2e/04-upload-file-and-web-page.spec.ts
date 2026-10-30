import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAssistant, createProject, newWorkspace, registerWorkspace, sourceRow } from './helpers';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('a text file and a web page are both read, and one can be removed', async ({ page }) => {
    await registerWorkspace(page, newWorkspace('Upload'));
    await createProject(page, 'Upload project');
    await createAssistant(page, 'Upload project', 'Upload helper');
    await page.getByRole('link', { name: 'Knowledge' }).click();

    await page.locator('input[type="file"]').setInputFiles(path.join(fixtures, 'sample.txt'));
    // The page says which file is chosen once the upload has finished; only then is it safe to submit.
    await expect(page.getByText('Chosen: sample.txt')).toBeVisible();
    await page.getByRole('button', { name: 'Upload file' }).click();

    const fileRow = sourceRow(page, 'sample.txt');
    await expect(fileRow).toContainText('File');
    await expect(fileRow.getByText('Ready')).toBeVisible();

    await page.getByLabel('Web address').fill('https://example.com/about-us');
    await page.getByRole('button', { name: 'Add web page' }).click();

    const pageRow = sourceRow(page, 'https://example.com/about-us');
    await expect(pageRow).toContainText('Web page');
    await expect(pageRow.getByText('Ready')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await pageRow.getByRole('button', { name: 'Remove' }).click();

    await expect(pageRow).toBeHidden();
    await expect(fileRow).toBeVisible();
});
