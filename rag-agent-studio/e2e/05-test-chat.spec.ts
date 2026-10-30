import { test, expect } from '@playwright/test';
import { assistantWithKnowledge } from './helpers';

test('the test chat answers and says which knowledge it used', async ({ page }) => {
    const { id } = await assistantWithKnowledge(page, 'Testchat');

    await page.goto(`/agents/${id}/test`);
    await expect(page.getByText('Ask a question to see how your assistant replies.')).toBeVisible();
    await expect(page.getByText('Add knowledge first.')).toBeHidden();

    await page.getByLabel('Your message').fill('When are you open?');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText('You', { exact: true })).toBeVisible();
    await expect(page.getByText('When are you open?', { exact: true })).toBeVisible();
    await expect(page.getByText('Fake answer about: When are you open?')).toBeVisible();
    await expect(page.getByText('Based on: Opening hours')).toBeVisible();

    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(page.getByText('Ask a question to see how your assistant replies.')).toBeVisible();
});
