import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assistantWithKnowledge, publish } from './helpers';

const hostPage = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'host.html'), 'utf8');

test("the website snippet adds a chat button to a customer's site and the chat works inside it", async ({ page, browser, baseURL }) => {
    const { id, assistantName } = await assistantWithKnowledge(page, 'Snippet');
    const key = await publish(page, id);

    const script = await page.request.get(`/embed/${key}.js`);
    expect(script.status()).toBe(200);
    expect(script.headers()['content-type']).toContain('application/javascript');

    const site = await browser.newContext();
    const host = await site.newPage();
    await host.setContent(hostPage.replace('BASE_URL', baseURL ?? '').replace('KEY', key), { waitUntil: 'load' });

    const button = host.getByRole('button', { name: `Chat with ${assistantName}` });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    const widget = host.frameLocator(`iframe[title="Chat with ${assistantName}"]`);
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(widget.getByText('Hi! How can I help you today?')).toBeVisible();

    await widget.getByLabel('Your message').fill('Do you make custom cakes?');
    await widget.getByRole('button', { name: 'Send' }).click();

    await expect(widget.getByText('Fake answer about: Do you make custom cakes?')).toBeVisible();
    await expect(widget.getByText('Based on: Opening hours')).toBeVisible();

    await site.close();
});
