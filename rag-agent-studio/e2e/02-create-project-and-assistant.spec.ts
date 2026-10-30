import { test, expect } from '@playwright/test';
import { createAssistant, createProject, newWorkspace, registerWorkspace } from './helpers';

test('an owner creates a project, adds an assistant and saves its setup', async ({ page }) => {
    await registerWorkspace(page, newWorkspace('Create'));

    await createProject(page, 'Bakery website');
    await expect(page.getByRole('link', { name: /Bakery website/ })).toContainText('0 assistants');

    await createAssistant(page, 'Bakery website', 'Bakery helper');
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Setup' })).toHaveAttribute('aria-current', 'page');

    await page.getByLabel('Greeting').fill('Hello! Ask me anything about the bakery.');
    await page.getByLabel('Tone').selectOption({ label: 'Short and direct' });
    await page.getByLabel('What it helps with').fill('Opening hours, orders and allergens.');
    await page.getByLabel('Fallback reply').fill("I'm not sure about that, please call the shop.");
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Saved', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Greeting')).toHaveValue('Hello! Ask me anything about the bakery.');
    await expect(page.getByLabel('Tone')).toHaveValue('concise');
});
