# SSH Key Setup for GitHub

This guide will help you set up SSH authentication to upload files from your local storage to this repository.

## What is an SSH Key?

SSH keys provide a secure way to authenticate with GitHub without using a password. You generate a key pair on your local machine (public and private), then add the public key to your GitHub account.

## Method 1: SSH Authentication (Recommended)

### Step 1: Check for Existing SSH Keys

Open your terminal and run:

```bash
ls -al ~/.ssh
```

Look for files named `id_rsa.pub`, `id_ecdsa.pub`, or `id_ed25519.pub`. If you see any of these, you already have an SSH key.

### Step 2: Generate a New SSH Key (if needed)

If you don't have an SSH key, generate one:

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Or if your system doesn't support Ed25519:

```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

Press Enter to accept the default file location, and optionally enter a passphrase for extra security.

### Step 3: Add SSH Key to ssh-agent

Start the ssh-agent:

```bash
eval "$(ssh-agent -s)"
```

Add your SSH private key to the ssh-agent:

```bash
ssh-add ~/.ssh/id_ed25519
```

Or if you used RSA:

```bash
ssh-add ~/.ssh/id_rsa
```

### Step 4: Add SSH Key to Your GitHub Account

Copy your public key to clipboard:

**macOS:**
```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

**Linux:**
```bash
cat ~/.ssh/id_ed25519.pub
```
Then manually copy the output.

**Windows (Git Bash):**
```bash
clip < ~/.ssh/id_ed25519.pub
```

Then:
1. Go to GitHub.com and log in
2. Click your profile photo → **Settings**
3. In the left sidebar, click **SSH and GPG keys**
4. Click **New SSH key**
5. Give it a descriptive title (e.g., "My Laptop")
6. Paste your key into the "Key" field
7. Click **Add SSH key**

### Step 5: Test Your SSH Connection

```bash
ssh -T git@github.com
```

You should see a message like: "Hi username! You've successfully authenticated..."

### Step 6: Clone or Update Your Repository

If you haven't cloned the repository yet:

```bash
git clone git@github.com:iamthetonyb/lunas-os.git
cd lunas-os
```

If you already have the repository cloned with HTTPS, update the remote:

```bash
cd lunas-os
git remote set-url origin git@github.com:iamthetonyb/lunas-os.git
```

### Step 7: Upload Your Files

Now you can add and upload your files:

```bash
# Add your files
git add .

# Commit your changes
git commit -m "Add my local files"

# Push to GitHub
git push origin main
```

## Method 2: HTTPS with Personal Access Token

If you prefer not to use SSH, you can use HTTPS with a Personal Access Token:

### Step 1: Create a Personal Access Token

1. Go to GitHub.com → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. Give it a name and select scopes (at minimum: `repo`)
4. Click **Generate token**
5. **Copy the token immediately** (you won't be able to see it again!)

### Step 2: Use the Token When Pushing

When pushing, use your token as the password:

```bash
git push origin main
```

Username: your_github_username
Password: paste_your_token_here

Or configure Git to remember your credentials:

```bash
git config --global credential.helper store
```

Then push once with your token, and Git will remember it.

## Troubleshooting

### Permission Denied (publickey)

- Make sure your SSH key is added to your GitHub account
- Verify the SSH agent is running: `eval "$(ssh-agent -s)"`
- Check that your key is loaded: `ssh-add -l`

### Repository Access Issues

- Ensure you have write access to the repository
- If it's not your repository, you may need to fork it first

### Large Files

- If you have files larger than 100MB, consider using Git LFS (Large File Storage)
- Install Git LFS: `git lfs install`
- Track large files: `git lfs track "*.large_file_extension"`

## Quick Reference

**SSH Clone URL:** `git@github.com:iamthetonyb/lunas-os.git`

**HTTPS Clone URL:** `https://github.com/iamthetonyb/lunas-os.git`

For more information, visit [GitHub's SSH documentation](https://docs.github.com/en/authentication/connecting-to-github-with-ssh).
