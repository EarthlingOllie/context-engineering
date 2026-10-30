import { test, expect } from '@playwright/test';
import { assistantWithKnowledge, escapeRegExp } from './helpers';

test('publishing makes the assistant live with a copyable share link and snippet; resetting changes the link', async ({ page, baseURL }) => {
    const { id } = await assistantWithKnowledge(page, 'Publish');

    await page.goto(`/agents/${id}/share`);
    await expect(page.getByText('Your assistant is not live yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page.getByText('Live', { exact: true })).toBeVisible();
    await expect(page.getByText('Your assistant is live.')).toBeVisible();

    const shareLink = page.getByLabel('Share link');
    const snippet = page.getByLabel('Website snippet');
    const origin = escapeRegExp(baseURL ?? '');
    await expect(shareLink).toHaveValue(new RegExp(`^${origin}/chat/[A-Za-z0-9_-]{32}$`));
    await expect(snippet).toHaveValue(new RegExp(`^<script src="${origin}/embed/[A-Za-z0-9_-]{32}\\.js" async></script>$`));

    const linkBefore = await shareLink.inputValue();
    const key = linkBefore.split('/chat/')[1];
    expect(await snippet.inputValue()).toContain(`/embed/${key}.js`);

    const copyButtons = page.getByRole('button', { name: 'Copy' });
    await copyButtons.first().click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(linkBefore);

    await copyButtons.last().click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await snippet.inputValue());

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Reset link' }).click();

    await expect(shareLink).not.toHaveValue(linkBefore);
    await expect(shareLink).toHaveValue(/\/chat\/[A-Za-z0-9_-]{32}$/);
    await expect(snippet).not.toHaveValue(new RegExp(escapeRegExp(key)));
    await expect(page.getByText('Live', { exact: true })).toBeVisible();
});
