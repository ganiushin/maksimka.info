#!/usr/bin/env python3
"""Prepare the site for publishing:  python3 prerender.py

1. Writes the Russian resume text into index.html, so search engines see it without JavaScript
   (the page script replaces this static copy with the live render).
2. Stamps a build id onto the page, styles.css, app.js and the portrait, and writes it to
   version.txt. Browsers then fetch fresh files after every publish, and an open or cached
   page reloads itself when it sees a newer version.txt.
3. Prints the page to assets/resume-ru.pdf and assets/resume-en.pdf with headless Chrome.
4. Refreshes the date in sitemap.xml.
"""
import hashlib
import subprocess
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import re
from datetime import date
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
resume = json.loads((ROOT / "data/resume-content.json").read_text(encoding="utf-8"))["ru"]
projects = json.loads((ROOT / "data/projects.json").read_text(encoding="utf-8"))


def ru(value):
    return value if isinstance(value, str) else value.get("ru", "")


def items(values):
    return "".join(f"<li>{escape(v)}</li>" for v in values)


def experience(job):
    return (
        '<article class="timeline-item">'
        f'<div class="timeline-meta">{escape(job["period"])}</div>'
        f'<h3 class="timeline-role">{escape(job["role"])}</h3>'
        f'<p class="timeline-company">{escape(job["company"])}</p>'
        f'<ul class="timeline-points">{items(job["points"])}</ul>'
        "</article>"
    )


def project(entry):
    links = "".join(
        f'<a href="{escape(link["url"])}">{escape(ru(link["text"]))}</a>' for link in entry.get("links", [])
    )
    return (
        '<article class="project"><div class="project-body">'
        f'<span class="project-label">{escape(ru(entry["label"]))}</span>'
        f'<h3 class="project-title">{escape(ru(entry["title"]))}</h3>'
        f'<p class="project-description">{escape(ru(entry["description"]))}</p>'
        f'<div class="project-links">{links}</div>'
        "</div></article>"
    )


titles = resume["sectionTitles"]
blocks = {
    "full-name": escape(resume["fullName"]),
    "headline": escape(resume["headline"]),
    "contacts": "".join(f"<span>{escape(c)}</span>" for c in resume["contacts"]),
    "profile-title": escape(titles["profile"]),
    "profile-text": escape(resume["profile"]),
    "experience-title": escape(titles["experience"]),
    "experience-list": "".join(experience(job) for job in resume["experience"]),
    "skills-title": escape(titles["skills"]),
    "skills-list": "".join(
        f'<div class="skill-group"><dt>{escape(g["title"])}</dt><dd>{escape(", ".join(g["items"]))}</dd></div>'
        for g in resume["skills"]
    ),
    "languages-title": escape(titles["languages"]),
    "languages-list": items(resume["languages"]),
    "education-title": escape(titles["education"]),
    "education-list": items(resume["education"]),
    "additional-title": escape(titles["additional"]),
    "additional-list": items(resume["additional"]),
    "projects-title": escape(ru(projects["ui"]["title"])),
    "projects-list": "".join(project(entry) for entry in projects["items"]),
}

# Build id: changes whenever anything the reader can see changes.
digest = hashlib.sha256()
for path in sorted(
    [ROOT / "app.js", ROOT / "styles.css", *(ROOT / "data").glob("*.json"), *(ROOT / "assets/media").glob("*")]
):
    if path.is_file():
        digest.update(path.name.encode())
        digest.update(path.read_bytes())
index = ROOT / "index.html"
html = index.read_text(encoding="utf-8")

# The page itself counts too, minus the parts this script writes into it.
skeleton = re.sub(r"(<!--prerender:[\w-]+-->).*?(<!--/prerender:[\w-]+-->)", r"\1\2", html, flags=re.S)
skeleton = re.sub(r'(<meta name="build" content=")[^"]*(")', r"\1\2", skeleton)
skeleton = re.sub(r"(\?v=)[\w-]+", r"\1", skeleton)
digest.update(skeleton.encode())
build = digest.hexdigest()[:10]
html = re.sub(r'(<meta name="build" content=")[^"]*(")', rf"\g<1>{build}\g<2>", html)
html = re.sub(r"((?:styles\.css|app\.js|portrait\.jpg)\?v=)[\w-]+", rf"\g<1>{build}", html)
for name, content in blocks.items():
    pattern = re.compile(rf"(<!--prerender:{re.escape(name)}-->).*?(<!--/prerender:{re.escape(name)}-->)", re.S)
    html, count = pattern.subn(lambda m: m.group(1) + content + m.group(2), html)
    if count != 1:
        raise SystemExit(f"marker for {name!r} found {count} times in index.html")
index.write_text(html, encoding="utf-8")

(ROOT / "version.txt").write_text(build + "\n", encoding="utf-8")

(ROOT / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    f"  <url><loc>https://maksimka.info/</loc><lastmod>{date.today().isoformat()}</lastmod></url>\n"
    "</urlset>\n",
    encoding="utf-8",
)
print(f"prerendered {len(blocks)} blocks, build {build}, sitemap dated {date.today().isoformat()}")


# PDF copies of the resume, printed from the page itself so they always match it.
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def print_pdfs():
    if not CHROME.exists():
        print("Chrome not found: PDF files were not regenerated")
        return
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        for lang in ("ru", "en"):
            target = ROOT / f"assets/resume-{lang}.pdf"
            subprocess.run(
                [
                    str(CHROME),
                    "--headless=new",
                    "--disable-gpu",
                    "--no-pdf-header-footer",
                    "--virtual-time-budget=8000",
                    f"--print-to-pdf={target}",
                    f"http://127.0.0.1:{server.server_port}/?lang={lang}",
                ],
                check=True,
                capture_output=True,
                timeout=120,
            )
            print(f"{target.relative_to(ROOT)}: {target.stat().st_size // 1024} KB")
    finally:
        server.shutdown()


print_pdfs()
