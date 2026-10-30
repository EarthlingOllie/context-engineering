import { expect, type Page } from '@playwright/test';

// Shared steps written the way a person would describe them. Every journey
// starts from its own freshly registered workspace so tests never share data.

let counter = 0;

export function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function uniqueSuffix(): string {
    counter += 1;

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-${counter}`;
}

export type Workspace = {
    workspaceName: string;
    ownerName: string;
    email: string;
    password: string;
};

export function newWorkspace(label = 'Workspace'): Workspace {
    const suffix = uniqueSuffix();

    return {
        workspaceName: `${label} ${suffix}`,
        ownerName: `Owner ${suffix}`,
        email: `owner-${suffix}@example.com`,
        password: 'correct horse battery',
    };
}

export async function registerWorkspace(page: Page, workspace: Workspace): Promise<void> {
    await page.goto('/register');
    await page.getByLabel('Workspace name').fill(workspace.workspaceName);
    await page.getByLabel('Your name').fill(workspace.ownerName);
    await page.getByLabel('Email').fill(workspace.email);
    await page.getByLabel('Password').fill(workspace.password);
    await page.getByRole('button', { name: 'Create workspace' }).click();

    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
}

export async function logIn(page: Page, email: string, password: string): Promise<void> {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
}

export async function logOut(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);
}

// The card for one project on the Projects page: its link reads "<name> <n> assistants",
// so it is found by its exact heading rather than a loose pattern on the whole name.
export function projectCard(page: Page, name: string) {
    return page.getByRole('listitem').filter({ has: page.getByRole('heading', { name, exact: true }) }).getByRole('link');
}

export async function createProject(page: Page, name: string): Promise<void> {
    await page.goto('/projects');
    await page.getByRole('button', { name: 'New project' }).click();
    await page.getByLabel('Project name').fill(name);
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(projectCard(page, name)).toBeVisible();
}

export async function openProject(page: Page, name: string): Promise<void> {
    await page.goto('/projects');
    await projectCard(page, name).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
}

export async function createAssistant(page: Page, projectName: string, assistantName: string): Promise<void> {
    await openProject(page, projectName);
    await page.getByRole('button', { name: 'New assistant' }).click();
    await page.getByLabel('Assistant name').fill(assistantName);
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page).toHaveURL(/\/agents\/\d+\/setup$/);
    await expect(page.getByRole('heading', { name: assistantName })).toBeVisible();
}

export function assistantId(page: Page): string {
    const match = page.url().match(/\/agents\/(\d+)\//);

    if (!match) {
        throw new Error(`Not on an assistant page: ${page.url()}`);
    }

    return match[1];
}

export function sourceRow(page: Page, title: string) {
    return page.getByRole('listitem').filter({ hasText: title });
}

export async function addPastedText(page: Page, title: string, text: string): Promise<void> {
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Text', { exact: true }).fill(text);
    await page.getByRole('button', { name: 'Add text' }).click();

    await expect(sourceRow(page, title).getByText('Ready')).toBeVisible();
}

// Registers a workspace, creates a project and an assistant, gives it one
// pasted-text source and leaves the browser on the assistant's Knowledge tab.
export async function assistantWithKnowledge(page: Page, label: string): Promise<{ workspace: Workspace; projectName: string; assistantName: string; id: string }> {
    const workspace = newWorkspace(label);
    const projectName = `${label} project`;
    const assistantName = `${label} helper`;

    await registerWorkspace(page, workspace);
    await createProject(page, projectName);
    await createAssistant(page, projectName, assistantName);

    const id = assistantId(page);

    await page.getByRole('link', { name: 'Knowledge' }).click();
    await addPastedText(page, 'Opening hours', 'We are open from 7am to 4pm, Tuesday to Sunday. Closed on Mondays.');

    return { workspace, projectName, assistantName, id };
}

export async function publish(page: Page, id: string): Promise<string> {
    await page.goto(`/agents/${id}/share`);
    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page.getByText('Live', { exact: true })).toBeVisible();

    const shareLink = await page.getByLabel('Share link').inputValue();

    return shareLink.split('/chat/')[1];
}
