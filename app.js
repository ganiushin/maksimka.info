const DATA_PATHS = {
  resume: "./data/resume-content.json",
  projects: "./data/projects.json",
};

// Stamp written into index.html by prerender.py; it changes with every publish.
const BUILD = document.querySelector('meta[name="build"]')?.content ?? "dev";

// Media files keep their names between publishes, so the stamp goes on the URL
// to stop browsers showing a cached older picture.
const versioned = (path) => `${path}?v=${BUILD}`;

const state = {
  lang: new URLSearchParams(location.search).get("lang") === "en" ? "en" : "ru",
  resume: null,
  projects: null,
  // ?reveal=1 is used when the PDF is printed: paper cannot be clicked
  phoneRevealed: new URLSearchParams(location.search).has("reveal"),
};

const $ = (selector) => document.querySelector(selector);

// A value is either a plain string or a { ru, en } pair.
const t = (value) => (typeof value === "string" ? value : value?.[state.lang] ?? "");

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
};

/* Resume */

/* The phone number is kept out of the page source and the data file in readable
   form, so scrapers do not collect it. A person sees a shimmering spoiler and
   gets the number with one click. */

const decodePhone = (encoded) => atob(encoded).split("").reverse().join("");

const phoneLink = (encoded) => {
  const phone = decodePhone(encoded);
  const link = el("a", "phone-revealed", phone);
  link.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
  return link;
};

// Drifting, twinkling specks, like a hidden message in a messenger.
const animateSpoiler = (canvas) => {
  const context = canvas.getContext("2d");
  let specks = null;
  let waited = 0;
  const frame = () => {
    if (!canvas.isConnected) {
      if (specks || ++waited > 120) {
        return; // removed from the page (revealed or re-rendered): stop
      }
      requestAnimationFrame(frame);
      return;
    }
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!specks) {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.scale(ratio, ratio);
      specks = Array.from({ length: Math.round(width * 1.1) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        phase: Math.random() * Math.PI * 2,
        size: 0.8 + Math.random() * 0.9,
      }));
    }
    context.clearRect(0, 0, width, height);
    specks.forEach((speck) => {
      speck.x = (speck.x + speck.vx + width) % width;
      speck.y = (speck.y + speck.vy + height) % height;
      speck.phase += 0.07;
      context.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(speck.phase));
      context.fillStyle = "#1a2026";
      context.fillRect(speck.x, speck.y, speck.size, speck.size);
    });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

const phoneNode = (encoded) => {
  if (state.phoneRevealed) {
    return phoneLink(encoded);
  }
  const spoiler = el("button", "phone-spoiler");
  spoiler.type = "button";
  spoiler.setAttribute("aria-label", t(state.projects.ui.showPhone));
  spoiler.title = t(state.projects.ui.showPhone);
  const canvas = el("canvas");
  spoiler.append(canvas);
  animateSpoiler(canvas);
  spoiler.addEventListener("click", () => {
    state.phoneRevealed = true;
    spoiler.classList.add("is-revealing");
    setTimeout(() => {
      const link = phoneLink(encoded);
      spoiler.replaceWith(link);
      link.focus({ preventScroll: true });
    }, 280);
  });
  return spoiler;
};

const contactNode = (text) => {
  if (typeof text === "object") {
    return phoneNode(text.phone);
  }
  if (text.includes("@")) {
    const link = el("a", "", text);
    link.href = `mailto:${text}`;
    return link;
  }
  if (/^\+?[\d\s()-]{7,}$/.test(text)) {
    const link = el("a", "", text);
    link.href = `tel:${text.replace(/[^\d+]/g, "")}`;
    return link;
  }
  return el("span", "", text);
};

const svg = (markup, viewBox) => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true">${markup}</svg>`;
  return wrapper.firstElementChild;
};

// Road sign for a job: a blue plate with the start year on a post, and above it
// the yellow "priority road" diamond for current jobs or "no stopping" for finished ones.
const signNode = (year, isCurrent) => {
  const plateY = 36;
  const height = plateY + 44;
  const diamond = isCurrent
    ? `<g transform="rotate(45 22 17)">
         <rect x="11" y="6" width="22" height="22" rx="2.5" fill="#fff" stroke="#2b333a" stroke-width="1.5"/>
         <rect x="15" y="10" width="14" height="14" rx="1.2" fill="#f5b800"/>
       </g>`
    : `<circle cx="22" cy="17" r="15" fill="#fff"/>
       <circle cx="22" cy="17" r="12" fill="#0a5ca8" stroke="#d6312b" stroke-width="4"/>
       <path d="M13.5 8.5 L30.5 25.5 M30.5 8.5 L13.5 25.5" stroke="#d6312b" stroke-width="3.5"/>`;
  const sign = el("span", "timeline-sign");
  sign.append(
    svg(
      `<rect x="20.5" y="${plateY + 16}" width="3" height="28" fill="#8b959d"/>
       ${diamond}
       <rect x="1" y="${plateY}" width="42" height="18" rx="3" fill="#0a5ca8"/>
       <rect x="2.5" y="${plateY + 1.5}" width="39" height="15" rx="2" fill="none" stroke="#fff" stroke-width="1"/>
       <text x="22" y="${plateY + 13}" text-anchor="middle" font-size="11" font-weight="600" fill="#fff" font-family="inherit">${year}</text>`,
      `0 0 44 ${height}`,
    ),
  );
  return sign;
};

// A self-driving car seen from above, driving up the road: white body, dark glass,
// a sensor pod with a lidar on the roof. An original drawing, not any maker's model.
// The element keeps the "rover" name it had when it was a delivery robot.
const roverNode = () => {
  const rover = el("span", "timeline-rover");
  rover.append(
    svg(
      `<g fill="#14181c">
         <rect x="0.6" y="6" width="3" height="6" rx="1.2"/><rect x="16.4" y="6" width="3" height="6" rx="1.2"/>
         <rect x="0.6" y="22" width="3" height="6" rx="1.2"/><rect x="16.4" y="22" width="3" height="6" rx="1.2"/>
       </g>
       <path d="M6 1.5h8a4 4 0 0 1 4 4v23a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-23a4 4 0 0 1 4-4z" fill="#fff" stroke="#14181c" stroke-width="1"/>
       <path d="M4.6 10.5q5.4-2.6 10.8 0l-1.1 4.2h-8.6z" fill="#14181c"/>
       <path d="M5.6 25.2h8.8l1 3.6q-5.4 1.9-10.8 0z" fill="#14181c"/>
       <rect x="5.4" y="16" width="9.2" height="7.6" rx="1.6" fill="#e6e9ec" stroke="#14181c" stroke-width="0.6"/>
       <circle cx="10" cy="19.8" r="2.3" fill="#14181c"/><circle cx="10" cy="19.8" r="0.9" fill="#f5b800"/>
       <rect x="4.2" y="2.6" width="3.2" height="1.6" rx="0.8" fill="#f5b800"/><rect x="12.6" y="2.6" width="3.2" height="1.6" rx="0.8" fill="#f5b800"/>
       <g class="rover-tail-lights" fill="#d6312b"><rect x="4.2" y="30" width="3.4" height="1.6" rx="0.8"/><rect x="12.4" y="30" width="3.4" height="1.6" rx="0.8"/></g>`,
      "0 0 20 34",
    ),
  );
  return rover;
};

const experienceNode = (job) => {
  const item = el("article", "timeline-item");
  const isCurrent = /н\.в\.|present/i.test(job.period);
  item.classList.toggle("is-current", isCurrent);
  item.append(signNode(job.period.match(/\d{4}/)?.[0] ?? "", isCurrent));

  const points = el("ul", "timeline-points");
  points.append(...job.points.map((point) => el("li", "", point)));

  item.append(
    el("div", "timeline-meta", job.period),
    el("h3", "timeline-role", job.role),
    el("p", "timeline-company", job.company),
    points,
  );
  return item;
};

const skillGroupNode = (group) => {
  const row = el("div", "skill-group");
  row.append(el("dt", "", group.title), el("dd", "", group.items.join(", ")));
  return row;
};

// List items may carry links written as [label](https://address).
const listItems = (items) =>
  items.map((item) => {
    const li = el("li");
    item.split(/(\[[^\]]+\]\(https?:[^)]+\))/).forEach((part) => {
      const match = part.match(/^\[([^\]]+)\]\((https?:[^)]+)\)$/);
      if (!match) {
        li.append(part);
        return;
      }
      const link = el("a", "", match[1]);
      link.href = match[2];
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      li.append(link);
    });
    return li;
  });

const renderResume = () => {
  const content = state.resume[state.lang];
  const titles = content.sectionTitles;

  document.documentElement.lang = state.lang;
  document.title = `${content.fullName} — ${content.headline}`;

  $("#full-name").textContent = content.fullName;
  $("#headline").textContent = content.headline;
  // The site address is only needed on paper: the PDF should lead back here.
  const site = el("a", "print-only", "maksimka.info");
  site.href = "https://maksimka.info/";
  $("#contacts").replaceChildren(...content.contacts.slice(0, 2).map(contactNode), site, ...content.contacts.slice(2).map(contactNode));

  $("#profile-title").textContent = titles.profile;
  $("#profile-text").textContent = content.profile;

  $("#experience-title").textContent = titles.experience;
  $("#experience-list").replaceChildren(
    roverNode(),
    ...content.experience.map(experienceNode),
    el("span", "timeline-start"),
  );

  $("#skills-title").textContent = titles.skills;
  $("#skills-list").replaceChildren(...content.skills.map(skillGroupNode));

  $("#languages-title").textContent = titles.languages;
  $("#languages-list").replaceChildren(...listItems(content.languages));

  $("#education-title").textContent = titles.education;
  $("#education-list").replaceChildren(...listItems(content.education));

  $("#additional-title").textContent = titles.additional;
  $("#additional-list").replaceChildren(...listItems(content.additional));
};

/* Photo viewer */

const viewer = {
  dialog: $("#lightbox"),
  image: $("#lightbox-image"),
  caption: $("#lightbox-caption"),
  counter: $("#lightbox-counter"),
  prev: $("#lightbox-prev"),
  next: $("#lightbox-next"),
  close: $("#lightbox-close"),
  slides: [],
  index: 0,
};

const showSlide = (index) => {
  const count = viewer.slides.length;
  viewer.index = (index + count) % count;
  const slide = viewer.slides[viewer.index];
  viewer.image.src = versioned(t(slide.src));
  viewer.image.alt = t(slide.caption);
  viewer.caption.textContent = t(slide.caption);
  viewer.counter.textContent = count > 1 ? `${viewer.index + 1} / ${count}` : "";
  viewer.prev.hidden = count < 2;
  viewer.next.hidden = count < 2;
};

const openViewer = (slides) => {
  const ui = state.projects.ui;
  viewer.slides = slides;
  viewer.prev.setAttribute("aria-label", t(ui.prev));
  viewer.next.setAttribute("aria-label", t(ui.next));
  viewer.close.setAttribute("aria-label", t(ui.close));
  showSlide(0);
  viewer.dialog.showModal();
};

const attachViewerHandlers = () => {
  viewer.prev.addEventListener("click", () => showSlide(viewer.index - 1));
  viewer.next.addEventListener("click", () => showSlide(viewer.index + 1));
  viewer.close.addEventListener("click", () => viewer.dialog.close());
  viewer.dialog.addEventListener("click", (event) => {
    if (event.target === viewer.dialog) {
      viewer.dialog.close();
    }
  });
  viewer.dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      showSlide(viewer.index - 1);
    } else if (event.key === "ArrowRight") {
      showSlide(viewer.index + 1);
    }
  });
};

/* Projects */

// The cover is a button: it opens the project's photos full screen.
const coverNode = (project) => {
  const slides =
    project.gallery ?? (project.src ? [{ src: project.src, caption: project.title }] : []);
  if (!slides.length) {
    return null;
  }

  const cover = el("button", "project-cover");
  cover.type = "button";
  cover.classList.toggle("is-contained", project.fit === "contain");

  const image = el("img");
  image.loading = "lazy"; // covers sit at the bottom of a long page
  image.decoding = "async";
  image.src = versioned(t(slides[0].src));
  image.alt = t(project.title);
  image.addEventListener("error", () => cover.remove(), { once: true });
  cover.append(image);

  if (slides.length > 1) {
    cover.append(el("span", "project-cover-count", `${slides.length} ${t(state.projects.ui.photos)}`));
  }
  cover.addEventListener("click", () => openViewer(slides));
  return cover;
};

const projectNode = (project) => {
  const card = el("article", "project");
  const body = el("div", "project-body");

  const links = el("div", "project-links");
  (project.links ?? []).forEach((entry) => {
    const link = el("a", "", t(entry.text));
    link.href = entry.url;
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    links.append(link);
  });

  body.append(
    el("span", "project-label", t(project.label)),
    el("h3", "project-title", t(project.title)),
    el("p", "project-description", t(project.description)),
    links,
  );

  const cover = coverNode(project);
  if (cover) {
    card.append(cover);
  }
  card.append(body);
  return card;
};

const renderProjects = () => {
  $("#projects-title").textContent = t(state.projects.ui.title);
  $("#projects-list").replaceChildren(...state.projects.items.map(projectNode));
};

/* Navigator: a road-sign chip whose message changes as the reader scrolls,
   and the rover that drives along the experience road. */

const guide = { chip: $("#navigator"), text: $("#navigator-text"), index: -1, dismissed: false, holdUntil: 0 };

const showOnChip = (stop) => {
  if (guide.dismissed) {
    return;
  }
  const node = stop.href ? el("a", "", stop.text) : el("span", "", stop.text);
  if (stop.href) {
    node.href = stop.href;
  }
  guide.text.replaceChildren(node);
  guide.chip.classList.toggle("is-warning", Boolean(stop.warning));
  guide.chip.hidden = false;
  guide.chip.classList.remove("is-fresh");
  void guide.chip.offsetWidth; // restart the highlight animation
  guide.chip.classList.add("is-fresh");
};

// Each message is tied to a place on the page, not to a scroll percentage:
// it switches the moment that place comes into view.
const hasReached = (stop) => {
  if (stop.anchor === "top") {
    return true;
  }
  if (stop.anchor === "end") {
    return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 80;
  }
  const target =
    stop.anchor === "job"
      ? [...document.querySelectorAll(".timeline-item")].find((item) =>
          item.querySelector(".timeline-company").textContent.startsWith(stop.company),
        )
      : $(`#${stop.anchor}-title`);
  return Boolean(target) && target.getBoundingClientRect().top < window.innerHeight * 0.8;
};

const updateNavigator = () => {
  const stops = state.resume?.[state.lang].navigator;
  if (!stops || guide.dismissed || performance.now() < guide.holdUntil) {
    return; // a warning on the chip is not replaced until it has been read
  }
  let index = 0;
  stops.forEach((stop, i) => {
    if (hasReached(stop)) {
      index = i;
    }
  });
  if (index === guide.index) {
    return;
  }
  guide.index = index;
  showOnChip(stops[index]);
};

// The rover follows the scroll along the road and faces the way it is going.
// Change direction briskly and it turns around on the spot. Change direction
// slowly and it does not bother: it backs up with its tail lights on. That is
// the easter egg, and the chip says so the first time it happens.
const TURN_SPEED = 0.6; // px per ms of travel; slower than this means reversing

const roverState = { offset: 0, time: 0, heading: 0, eggShown: false };

const updateRover = () => {
  const road = $("#experience-list");
  const rover = road.querySelector(".timeline-rover");
  if (!rover) {
    return;
  }
  const rect = road.getBoundingClientRect();
  const travel = rect.height - rover.offsetHeight - 30;
  const passed = Math.min(Math.max((window.innerHeight * 0.45 - rect.top) / rect.height, 0), 1);
  const offset = Math.round(passed * travel);

  const now = performance.now();
  const delta = offset - roverState.offset;
  const speed = Math.abs(delta) / Math.max(now - roverState.time, 1);
  const wanted = delta > 0 ? 180 : 0; // nose down when going down the page
  let reversing = rover.classList.contains("is-reversing");

  if (offset === 0) {
    roverState.heading = 0;
    reversing = false;
  } else if (roverState.offset === 0 && delta > 0) {
    roverState.heading = 180; // setting off from the top always starts nose first
    reversing = false;
  } else if (delta !== 0) {
    if (wanted === roverState.heading) {
      reversing = false;
    } else if (speed >= TURN_SPEED) {
      roverState.heading = wanted;
      reversing = false;
    } else {
      reversing = true;
      if (!roverState.eggShown) {
        roverState.eggShown = true;
        showOnChip({ text: state.resume[state.lang].navigatorEgg });
      }
    }
  }
  roverState.offset = offset;
  roverState.time = now;

  rover.classList.toggle("is-reversing", reversing);
  rover.style.transform = `translateY(${offset}px)`;
  rover.firstElementChild.style.transform = `rotate(${roverState.heading}deg)`;
};

// Scroll too fast and the chip turns into a speeding warning for a few seconds.
// Speed is averaged over the last fraction of a second, so both one long flick
// and a burst of quick wheel turns are caught.
const SPEED_LIMIT = 1.5; // px per ms of page scroll, a little under two screens a second
const SPEED_WINDOW = 220; // ms
const speedTrap = { samples: [], quietUntil: 0, timer: 0 };

const checkSpeed = () => {
  const now = performance.now();
  const samples = speedTrap.samples;
  samples.push({ time: now, y: window.scrollY });
  while (samples.length > 1 && now - samples[0].time > SPEED_WINDOW) {
    samples.shift();
  }
  const first = samples[0];
  const elapsed = now - first.time;
  const distance = Math.abs(window.scrollY - first.y);

  if (elapsed < 60 || distance < 320 || distance / elapsed < SPEED_LIMIT) {
    return;
  }
  if (now < speedTrap.quietUntil || guide.dismissed) {
    return;
  }
  speedTrap.quietUntil = now + 7000;
  guide.holdUntil = now + 4000;
  showOnChip({ text: state.resume[state.lang].navigatorSpeeding, warning: true });
  clearTimeout(speedTrap.timer);
  speedTrap.timer = setTimeout(() => {
    guide.holdUntil = 0;
    guide.index = -1; // put the regular message for this place back
    updateNavigator();
  }, 4000);
};

const attachScrollHandlers = () => {
  let queued = false;
  const onScroll = () => {
    if (queued) {
      return;
    }
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      updateNavigator();
      updateRover();
      checkSpeed();
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  $("#navigator-close").addEventListener("click", () => {
    guide.dismissed = true;
    guide.chip.hidden = true;
  });
};

/* Page */

const render = () => {
  renderResume();
  renderProjects();
  document.querySelectorAll(".lang-button").forEach((button) => {
    const active = button.dataset.lang === state.lang;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("#navigator-close").setAttribute("aria-label", t(state.projects.ui.hideHint));
  $("#portrait-button").setAttribute("aria-label", t(state.projects.ui.enlarge));  const pdf = $("#pdf-link");
  pdf.textContent = t(state.projects.ui.pdf);
  pdf.href = versioned(`./assets/resume-${state.lang}.pdf`);
  pdf.setAttribute("download", `${state.resume[state.lang].fullName}.pdf`);
  guide.holdUntil = 0;
  guide.index = -1;
  updateNavigator();
  updateRover();
};

// GitHub Pages lets browsers and its own CDN keep every file for ten minutes.
// So the page asks for version.txt under a one-off address, which no cache has,
// and if a newer build is out it reopens itself under an address stamped with
// that build: neither the browser nor the CDN can answer that from an old copy.
const reloadIfStale = async () => {
  try {
    const response = await fetch(`./version.txt?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const latest = (await response.text()).trim();
    if (latest && latest !== BUILD && sessionStorage.getItem("reloaded-for") !== latest) {
      sessionStorage.setItem("reloaded-for", latest);
      const fresh = new URL(location.href);
      fresh.searchParams.set("v", latest);
      location.replace(fresh);
    }
  } catch {
    // offline or blocked storage: keep showing what we have
  }
};

// The build stamp in the address has done its job once the page is open.
const tidyAddress = () => {
  const url = new URL(location.href);
  if (url.searchParams.has("v")) {
    url.searchParams.delete("v");
    history.replaceState(null, "", url);
  }
};

const loadJson = async (path) => {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  return response.json();
};

const bootstrap = async () => {
  [state.resume, state.projects] = await Promise.all([
    loadJson(DATA_PATHS.resume),
    loadJson(DATA_PATHS.projects),
  ]);

  document.querySelectorAll(".lang-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.lang = button.dataset.lang;
      render();
    });
  });
  attachViewerHandlers();
  attachScrollHandlers();
  window.addEventListener("beforeprint", () => {
    if (!state.phoneRevealed) {
      state.phoneRevealed = true;
      renderResume();
    }
  });
  tidyAddress();
  reloadIfStale();
  // A tab left open, or a page restored by the Back button, never "loads" again,
  // so it is also checked whenever the reader comes back to it.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      reloadIfStale();
    }
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      reloadIfStale();
    }
  });
  $("#portrait-button").addEventListener("click", () => {
    const portrait = $("#portrait-button img");
    openViewer([{ src: portrait.getAttribute("src").split("?")[0], caption: state.resume[state.lang].fullName }]);
  });
  render();
};

bootstrap().catch((error) => {
  console.error("Failed to initialize page:", error);
  const notice = $("#load-error");
  notice.hidden = false;
  notice.textContent = `Не удалось загрузить резюме: ${error.message}. Откройте страницу через локальный сервер: python3 serve.py`;
});
