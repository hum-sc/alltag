# alltag

A lightweight static blog where everyday thoughts are shared. Posts are written in Markdown and automatically published to GitHub Pages.

🌐 **Live site:** https://hum-sc.github.io/alltag/

---

## ✍️ How to Contribute (Add Your Blog Posts)

Alltag is a **collaborator-only** blog. To keep the site safe and free of inappropriate content, **all contributors must be approved by the repository owner** before they can publish posts.

### Step 1 — Request collaborator access

Open a [Collaborator Access Request issue](../../issues/new?template=collaborator-request.md) and fill in the template. The owner will review your request and grant access if approved.

> ⚠️ **No unsolicited pull requests are accepted from non-collaborators.** All contributors are vetted to prevent NSFW or otherwise inappropriate content from appearing on the website.

### Step 2 — Create your author directory

Once you have collaborator access, create a folder under `content/` using your GitHub username (or a chosen handle):

```
content/
└── your-username/
    ├── me.md          ← short "about me" shown on your author page (optional)
    └── images/        ← place images here (optional)
```

### Step 3 — Write a post

Create a new Markdown file inside your author directory. **You do not need to add a date prefix** — the CI workflow adds it automatically when you push to `main`.

Simply name your file with a descriptive slug:

```
content/your-username/my-first-post.md
```

After the workflow runs, it will be renamed to something like:

```
content/your-username/03-03-2026-my-first-post.md
```

#### Post format

Posts are plain Markdown. Use a `# Heading` as the post title if you like:

```markdown
# My First Post

Hello world! This is my first post on Alltag.
```

#### Adding images

Place images in `content/your-username/images/` and reference them with a relative path:

```markdown
![My image](images/my-photo.jpg)
```

### Step 4 — Push to main

Commit your new Markdown file and push to `main`. The GitHub Actions workflow will:

1. Add a date prefix to any undated files.
2. Build the static site.
3. Deploy the updated site to GitHub Pages.

---

## 📏 Content Rules

By contributing to Alltag you agree to follow these rules:

1. **No NSFW content** — No sexually explicit, graphic, or adult material of any kind.
2. **No hate speech** — No content that discriminates or incites hatred based on race, gender, religion, nationality, sexual orientation, or any other characteristic.
3. **No harassment** — Do not target or harass individuals.
4. **No spam** — Posts should be genuine thoughts or articles, not promotional spam.
5. **Respect copyright** — Only post content you own or have rights to.

Violations of these rules will result in immediate removal of the content and revocation of collaborator access.

---

## 🌿 Branch Protection Rules

| Branch | Protection |
|--------|-----------|
| `main` | Protected — direct pushes allowed only for collaborators; branch **cannot be deleted** |
| `gh-pages` | Protected — managed exclusively by the CI/CD workflow |

### Requesting deletion of the main branch

The `main` branch is **permanently protected from deletion**. If you believe a special action is needed that would involve removing or resetting `main`, you must open a [Branch Deletion Request issue](../../issues/new?template=branch-deletion-request.md) explaining the reason. The repository owner will review and act on it.

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Build the site locally
node build.js

# The output is placed in dist/
```

---

## 📄 License

See [LICENSE](LICENSE).
