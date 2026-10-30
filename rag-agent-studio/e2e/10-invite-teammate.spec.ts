import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProject, escapeRegExp, newWorkspace, projectCard, registerWorkspace, uniqueSuffix } from './helpers';

const logFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'storage', 'e2e', 'laravel.log');

test('an owner invites a teammate, who joins and sees the project; the owner can remove them', async ({ page, browser, baseURL }) => {
    const workspace = newWorkspace('Invite');
    const teammateEmail = `teammate-${uniqueSuffix()}@example.com`;

    await registerWorkspace(page, workspace);
    await createProject(page, 'Shared project');

    await page.getByRole('link', { name: 'Team' }).click();
    await expect(page.getByText("You're the only member so far.")).toBeVisible();

    await page.getByLabel('Email').fill(teammateEmail);
    await page.getByRole('button', { name: 'Invite' }).click();

    const pending = page.getByRole('region', { name: 'Pending invitations' });
    const invitation = pending.getByRole('listitem').filter({ hasText: teammateEmail });
    await expect(invitation).toBeVisible();
    // The owner is told the link was emailed and can copy it themselves.
    await expect(page.getByText(`We've emailed ${teammateEmail} an invitation.`)).toBeVisible();
    const inviteLink = await invitation.getByLabel('Invitation link').inputValue();
    expect(inviteLink).toMatch(new RegExp(`^${escapeRegExp(baseURL ?? '')}/invite/[A-Za-z0-9]{40}$`));
    await invitation.getByRole('button', { name: 'Copy' }).click();
    await expect(invitation.getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(inviteLink);

    // The same link was emailed (the e2e mailer writes emails to the log).
    expect(fs.readFileSync(logFile, 'utf8')).toContain(inviteLink);

    const teammate = await browser.newContext();
    const join = await teammate.newPage();
    await join.goto(inviteLink);
    await expect(join.getByRole('heading', { name: `Join ${workspace.workspaceName}` })).toBeVisible();
    await join.getByLabel('Your name').fill('Taylor Teammate');
    await join.getByLabel('Password').fill('another good password');
    await join.getByRole('button', { name: 'Join workspace' }).click();

    await expect(join).toHaveURL(/\/projects$/);
    await expect(projectCard(join, 'Shared project')).toBeVisible();

    // A member sees the team but not the invitation link, which only the owner should hand out.
    await join.getByRole('link', { name: 'Team' }).click();
    await expect(join.getByText('Only the owner can invite teammates.')).toBeVisible();
    await expect(join.getByLabel('Invitation link')).toHaveCount(0);
    await join.goto('/projects');

    await join.getByRole('link', { name: 'Team' }).click();
    await expect(join.getByText('Taylor Teammate')).toBeVisible();
    await expect(join.getByText('Member', { exact: true })).toBeVisible();
    await expect(join.getByRole('button', { name: 'Invite' })).toHaveCount(0);

    await page.reload();
    await expect(pending).toHaveCount(0);
    const member = page.getByRole('region', { name: 'Members' }).getByRole('listitem').filter({ hasText: 'Taylor Teammate' });
    await expect(member).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await member.getByRole('button', { name: 'Remove' }).click();
    await expect(member).toHaveCount(0);
    await expect(page.getByText("You're the only member so far.")).toBeVisible();

    await teammate.close();
});
