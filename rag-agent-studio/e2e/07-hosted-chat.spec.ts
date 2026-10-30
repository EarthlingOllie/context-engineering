import { test, expect } from '@playwright/test';
import { assistantWithKnowledge, publish } from './helpers';

test('a visitor opens the share link and gets an answer', async ({ page, browser }) => {
    const { id, assistantName } = await assistantWithKnowledge(page, 'Hosted');
    const key = await publish(page, id);

    const visitor = await browser.newContext();
    const chat = await visitor.newPage();
    await chat.goto(`/chat/${key}`);

    await expect(chat.getByText(assistantName)).toBeVisible();
    await expect(chat.getByText('Hi! How can I help you today?')).toBeVisible();

    await chat.getByLabel('Your message').fill('Are you open on Mondays?');
    await chat.getByRole('button', { name: 'Send' }).click();

    await expect(chat.getByText('Are you open on Mondays?')).toBeVisible();
    await expect(chat.getByText('Fake answer about: Are you open on Mondays?')).toBeVisible();
    await expect(chat.getByText('Based on: Opening hours')).toBeVisible();

    await chat.getByLabel('Your message').fill('And Tuesdays?');
    await chat.getByRole('button', { name: 'Send' }).click();
    await expect(chat.getByText('Fake answer about: And Tuesdays?')).toBeVisible();

    await visitor.close();
});
