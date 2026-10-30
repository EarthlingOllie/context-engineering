import { test, expect } from '@playwright/test';
import { addPastedText, createAssistant, createProject, newWorkspace, registerWorkspace, sourceRow } from './helpers';

test('pasted text is read and becomes ready knowledge', async ({ page }) => {
    await registerWorkspace(page, newWorkspace('Paste'));
    await createProject(page, 'Paste project');
    await createAssistant(page, 'Paste project', 'Paste helper');

    await page.getByRole('link', { name: 'Knowledge' }).click();
    await expect(page.getByText('Add files, text or web pages so your assistant knows what to say.')).toBeVisible();

    await addPastedText(page, 'Returns policy', 'You can return any item within 30 days with a receipt.');

    const row = sourceRow(page, 'Returns policy');
    await expect(row).toContainText('Text');
    await expect(row.getByText('Ready')).toBeVisible();
    await expect(page.getByText('Add files, text or web pages so your assistant knows what to say.')).toBeHidden();
});
