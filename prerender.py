#!/usr/bin/env python3
"""Write the Russian resume text into index.html so search engines see it without running JavaScript.

Run after editing data/*.json and before publishing:  python3 prerender.py
The page script replaces this static copy with the live render, so readers never notice it.
Also refreshes the date in sitemap.xml.
"""
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

index = ROOT / "index.html"
html = index.read_text(encoding="utf-8")
for name, content in blocks.items():
    pattern = re.compile(rf"(<!--prerender:{re.escape(name)}-->).*?(<!--/prerender:{re.escape(name)}-->)", re.S)
    html, count = pattern.subn(lambda m: m.group(1) + content + m.group(2), html)
    if count != 1:
        raise SystemExit(f"marker for {name!r} found {count} times in index.html")
index.write_text(html, encoding="utf-8")

(ROOT / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    f"  <url><loc>https://maksimka.info/</loc><lastmod>{date.today().isoformat()}</lastmod></url>\n"
    "</urlset>\n",
    encoding="utf-8",
)
print(f"prerendered {len(blocks)} blocks, sitemap dated {date.today().isoformat()}")
