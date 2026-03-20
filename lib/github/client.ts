/**
 * GitHub API client for agentic code editing.
 * Uses Octokit to read/write files and commit directly to the repo.
 * Deployed on Vercel — no filesystem access needed.
 */
import { Octokit } from "@octokit/rest";

const OWNER = "iamthetonyb";
const REPO = "lunas-os";
const DEFAULT_BRANCH = "main";

function getOctokit() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN not set");
    return new Octokit({ auth: token });
}

/** Read a file from the repo. Returns content + SHA (needed for updates). */
export async function readRepoFile(path: string, branch = DEFAULT_BRANCH) {
    const octokit = getOctokit();
    const { data } = await octokit.repos.getContent({
        owner: OWNER,
        repo: REPO,
        path,
        ref: branch,
    });

    if (Array.isArray(data) || data.type !== "file") {
        throw new Error(`${path} is a directory, not a file`);
    }

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return { content, sha: data.sha, path: data.path };
}

/** List files in a directory. */
export async function listRepoDir(path: string, branch = DEFAULT_BRANCH) {
    const octokit = getOctokit();
    const { data } = await octokit.repos.getContent({
        owner: OWNER,
        repo: REPO,
        path,
        ref: branch,
    });

    if (!Array.isArray(data)) {
        return [{ name: (data as any).name, type: (data as any).type, path: (data as any).path }];
    }

    return data.map((item) => ({
        name: item.name,
        type: item.type,
        path: item.path,
    }));
}

/** Create or update a file in the repo. Commits directly to the branch. */
export async function writeRepoFile(
    path: string,
    content: string,
    commitMessage: string,
    branch = DEFAULT_BRANCH
) {
    const octokit = getOctokit();

    // Check if file exists (need SHA for update)
    let sha: string | undefined;
    try {
        const existing = await readRepoFile(path, branch);
        sha = existing.sha;
    } catch {
        // File doesn't exist — this is a create
    }

    const { data } = await octokit.repos.createOrUpdateFileContents({
        owner: OWNER,
        repo: REPO,
        path,
        message: commitMessage,
        content: Buffer.from(content).toString("base64"),
        branch,
        ...(sha ? { sha } : {}),
    });

    return {
        commitSha: data.commit.sha,
        commitUrl: data.commit.html_url,
        path,
    };
}

/** Apply a find-and-replace edit to an existing file. */
export async function editRepoFile(
    path: string,
    oldText: string,
    newText: string,
    commitMessage: string,
    branch = DEFAULT_BRANCH
) {
    const file = await readRepoFile(path, branch);

    if (!file.content.includes(oldText)) {
        throw new Error(
            `Could not find the text to replace in ${path}. Make sure oldText matches exactly.`
        );
    }

    const updatedContent = file.content.replace(oldText, newText);
    return writeRepoFile(path, updatedContent, commitMessage, branch);
}
