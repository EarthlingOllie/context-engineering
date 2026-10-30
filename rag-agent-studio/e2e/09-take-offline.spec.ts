import { test, expect } from '@playwright/test';
import { assistantWithKnowledge, publish } from './helpers';

test('taking an assistant offline shows visitors a friendly message and stops the chat', async ({ page, browser }) => {
    const { id } = await assistantWithKnowledge(page, 'Offline');
    const key = await publish(page, id);

    await page.getByRole('button', { name: 'Take offline' }).click();
    await expect(page.getByText('Offline', { exact: true })).toBeVisible();
    await expect(page.getByText('Your assistant is offline.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish' })).toBeEnabled();

    const visitor = await browser.newContext();
    const chat = await visitor.newPage();
    await chat.goto(`/chat/${key}`);
    await expect(chat.getByText('This assistant is currently unavailable.')).toBeVisible();
    await expect(chat.getByLabel('Your message')).toHaveCount(0);

    const reply = await chat.request.post(`/api/chat/${key}`, { data: { message: 'Hello?' } });
    expect(reply.status()).toBe(403);
    expect(await reply.json()).toEqual({ error: 'unavailable' });

    const script = await chat.request.get(`/embed/${key}.js`);
    expect(script.status()).toBe(200);
    expect(await script.text()).not.toContain('iframe');

    await visitor.close();
});
