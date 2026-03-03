# Images in Alltag Posts

Good news — images work just fine in Alltag posts!

## How to Add an Image

1. Place your image file inside `content/{your-name}/images/`:

```
content/alice/images/hello.png
```

2. Reference it in your Markdown with a **relative path**:

```markdown
![A navy banner](images/hello.png)
```

That's all. The build script copies the `images/` folder next to your post HTML, so the relative path resolves automatically.

## Example

Here is an image included in this very post:

![A navy rectangle](images/hello.png)

It was placed at `content/alice/images/hello.png` and referenced as `images/hello.png` — no absolute URLs needed.

## Tips

- Any common format works: PNG, JPEG, GIF, WebP, SVG.
- Keep image file names lowercase with hyphens (good for URLs).
- Images are copied incrementally — only newly added or changed images are re-copied on each push.
