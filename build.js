#!/usr/bin/env node
'use strict';

/**
 * Alltag Blog — Static Site Builder
 *
 * Usage: node build.js
 *
 * Incremental build logic:
 *   - Individual post HTML files are only (re)generated when their source .md
 *     file appears in `git diff HEAD~1 HEAD` (or when no HTML exists yet).
 *   - index.html, {author}/index.html, and search.json are always regenerated.
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { marked } = require('marked');

// ─── Paths ───────────────────────────────────────────────────────────────────

const ROOT      = __dirname;
const DIST      = path.join(ROOT, 'dist');
const CONTENT   = path.join(ROOT, 'content');
const TEMPLATES = path.join(ROOT, 'templates');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert Markdown to HTML using the `marked` library. */
function markdownToHtml(md) {
  return marked(md);
}

// ─── Filename Parsing ────────────────────────────────────────────────────────

/**
 * Parse "{dd}-{mm}-{yyyy}-{slug}.md" filenames.
 * Returns null for files that don't match the pattern.
 */
function parseFilename(filename) {
  const base  = path.basename(filename, '.md');
  const match = base.match(/^(\d{2})-(\d{2})-(\d{4})-(.+)$/);
  if (!match) return null;
  const [, dd, mm, yyyy, slug] = match;
  const title   = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const date    = `${dd}/${mm}/${yyyy}`;
  const sortKey = `${yyyy}${mm}${dd}`;
  return { dd, mm, yyyy, title, slug, date, sortKey, base };
}

// ─── Incremental Build — Changed Files ───────────────────────────────────────

/**
 * Returns a Set of relative paths that changed between the last two commits,
 * or null if the history is too short to diff (i.e. build everything).
 */
function getChangedFiles() {
  try {
    const raw = execSync('git diff --name-only HEAD~1 HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return new Set(raw.trim().split('\n').filter(Boolean));
  } catch {
    return null; // First commit or shallow clone — rebuild all posts
  }
}

// ─── Content Scanning ────────────────────────────────────────────────────────

function scanContent() {
  const posts   = [];
  const authors = [];

  if (!fs.existsSync(CONTENT)) return { posts, authors };

  for (const entry of fs.readdirSync(CONTENT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const author    = entry.name;
    const authorDir = path.join(CONTENT, author);
    authors.push(author);

    for (const file of fs.readdirSync(authorDir)) {
      if (!file.endsWith('.md') || file === 'me.md') continue;
      const parsed = parseFilename(file);
      if (!parsed) continue;

      // Relative paths used as keys (matches git diff output)
      const mdPath   = `content/${author}/${file}`;
      const htmlFile = `${parsed.base}.html`;
      const htmlPath = path.join(DIST, author, htmlFile);
      const url      = `/${author}/${htmlFile}`;

      posts.push({ author, file, mdPath, htmlPath, url, ...parsed });
    }
  }

  // Newest first
  posts.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  return { posts, authors };
}

// ─── Template Rendering ──────────────────────────────────────────────────────

function loadTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES, name), 'utf8');
}

function render(template, vars) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : ''
  );
}

// ─── Cleanup — Orphaned Dist Files ───────────────────────────────────────────

/**
 * Removes dist files/dirs that no longer have a corresponding content source:
 *   - dist/{author}/ is removed when the author's content directory is gone.
 *   - dist/{author}/{post}.html is removed when the source .md no longer exists.
 */
function cleanOrphanedFiles(posts, authors) {
  if (!fs.existsSync(DIST)) return;

  // Build a set of valid HTML paths for fast lookup
  const validHtmlPaths = new Set(posts.map(p => p.htmlPath));

  for (const entry of fs.readdirSync(DIST, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const author        = entry.name;
    const authorDistDir = path.join(DIST, author);

    // Author no longer has a content directory → remove entire dist folder
    if (!authors.includes(author)) {
      fs.rmSync(authorDistDir, { recursive: true, force: true });
      console.log(`  Removed orphaned author dir: dist/${author}`);
      continue;
    }

    // Remove individual HTML files whose source .md has been deleted
    for (const file of fs.readdirSync(authorDistDir)) {
      if (!file.endsWith('.html') || file === 'index.html') continue;

      const htmlPath = path.join(authorDistDir, file);
      if (!validHtmlPaths.has(htmlPath)) {
        fs.unlinkSync(htmlPath);
        console.log(`  Removed orphaned post HTML: dist/${author}/${file}`);
      }
    }
  }
}

// ─── Build ───────────────────────────────────────────────────────────────────

function build() {
  console.log('=== Alltag Build ===');

  // Load templates and CSS once
  const CSS           = fs.readFileSync(path.join(TEMPLATES, 'style.css'), 'utf8');
  const postTpl       = loadTemplate('post.html');
  const authorTpl     = loadTemplate('author.html');
  const indexTpl      = loadTemplate('index.html');

  // Ensure dist/ exists
  fs.mkdirSync(DIST, { recursive: true });

  // Detect changed files for incremental post building
  const changed = getChangedFiles();
  if (changed === null) {
    console.log('No previous commit — all posts will be (re)built.');
  } else {
    console.log(`Changed files: ${changed.size ? [...changed].join(', ') : '(none)'}`);
  }

  const { posts, authors } = scanContent();
  console.log(`Content: ${posts.length} post(s) across ${authors.length} author(s).`);

  // ── Cleanup orphaned dist files (deleted posts / authors) ────────────────
  cleanOrphanedFiles(posts, authors);

  // ── Individual post pages (incremental) ──────────────────────────────────
  let built = 0, skipped = 0;

  for (const post of posts) {
    const needsBuild = changed === null ||
                       !fs.existsSync(post.htmlPath) ||
                       changed.has(post.mdPath);

    if (!needsBuild) { skipped++; continue; }

    fs.mkdirSync(path.dirname(post.htmlPath), { recursive: true });

    const mdContent = fs.readFileSync(path.join(ROOT, post.mdPath), 'utf8');
    const html = render(postTpl, {
      TITLE:   escHtml(post.title),
      AUTHOR:  escHtml(post.author),
      DATE:    post.date,
      CONTENT: markdownToHtml(mdContent),
      URL:     post.url,
      CSS,
    });

    fs.writeFileSync(post.htmlPath, html);
    console.log(`  Built post: ${post.htmlPath}`);
    built++;
  }

  console.log(`Posts: ${built} built, ${skipped} skipped (unchanged).`);

  // ── Images (incremental copy) ─────────────────────────────────────────────
  // Authors place images in content/{author}/images/. Copy them to
  // dist/{author}/images/ so that relative src="images/…" refs in posts work.
  for (const author of authors) {
    const srcImgDir  = path.join(CONTENT, author, 'images');
    const distImgDir = path.join(DIST, author, 'images');
    if (!fs.existsSync(srcImgDir)) continue;

    fs.mkdirSync(distImgDir, { recursive: true });

    for (const imgFile of fs.readdirSync(srcImgDir)) {
      const srcFile  = path.join(srcImgDir, imgFile);
      const destFile = path.join(distImgDir, imgFile);
      // Only copy if: full rebuild, file missing from dist, or changed in this push
      const imgRelPath = `content/${author}/images/${imgFile}`;
      if (changed === null || !fs.existsSync(destFile) || changed.has(imgRelPath)) {
        fs.copyFileSync(srcFile, destFile);
        console.log(`  Copied image: dist/${author}/images/${imgFile}`);
      }
    }
  }

  // ── search.json (always) ─────────────────────────────────────────────────
  const searchData = posts.map(p => ({
    title:  p.title,
    author: p.author,
    date:   p.date,
    url:    p.url,
  }));
  fs.writeFileSync(
    path.join(DIST, 'search.json'),
    JSON.stringify(searchData, null, 2)
  );
  console.log('Built: dist/search.json');

  // ── Author index pages (always) ─────────────────────────────────────────
  for (const author of authors) {
    const authorPosts = posts.filter(p => p.author === author).slice(0, 10);

    let aboutHtml = '';
    const mePath  = path.join(CONTENT, author, 'me.md');
    if (fs.existsSync(mePath)) {
      aboutHtml = `<div class="about-me">${markdownToHtml(
        fs.readFileSync(mePath, 'utf8')
      )}</div><hr>`;
    }

    const postsHtml = authorPosts.length
      ? '<ul>' + authorPosts.map(p =>
          `<li><a href="${p.url}">${p.date} &mdash; ${escHtml(p.title)}</a></li>`
        ).join('\n') + '</ul>'
      : '<p><em>No posts yet.</em></p>';

    const html = render(authorTpl, {
      AUTHOR: escHtml(author),
      ABOUT:  aboutHtml,
      POSTS:  postsHtml,
      CSS,
    });

    fs.mkdirSync(path.join(DIST, author), { recursive: true });
    fs.writeFileSync(path.join(DIST, author, 'index.html'), html);
    console.log(`  Built author page: dist/${author}/index.html`);
  }

  // ── Global homepage (always) ─────────────────────────────────────────────
  const latestHtml = posts.slice(0, 10).length
    ? '<ul>' + posts.slice(0, 10).map(p =>
        `<li><a href="${p.url}">${p.date} &mdash; <strong>${escHtml(p.title)}</strong></a>` +
        ` &nbsp;<em>by <a href="/${p.author}/">${escHtml(p.author)}</a></em></li>`
      ).join('\n') + '</ul>'
    : '<p><em>No posts yet.</em></p>';

  const authorsHtml = authors.map(author => {
    const ap = posts.filter(p => p.author === author).slice(0, 10);
    const ul = ap.length
      ? '<ul>' + ap.map(p =>
          `<li><a href="${p.url}">${p.date} &mdash; ${escHtml(p.title)}</a></li>`
        ).join('\n') + '</ul>'
      : '<p><em>No posts yet.</em></p>';
    return `<div class="author-section">
  <h3><a href="/${author}/">${escHtml(author)}</a></h3>
  ${ul}
</div>`;
  }).join('\n');

  const indexHtml = render(indexTpl, {
    LATEST:  latestHtml,
    AUTHORS: authorsHtml,
    CSS,
  });

  fs.writeFileSync(path.join(DIST, 'index.html'), indexHtml);
  console.log('Built: dist/index.html');

  console.log('=== Build complete ===');
}

build();
