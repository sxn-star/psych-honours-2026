import { Client, Account, Storage, Databases, ID, Query, Permission, Role } from "https://cdn.jsdelivr.net/npm/appwrite@13.0.0/+esm";
import { findStudentPageBySlug, resolveCurrentStudentPage } from "./student-pages.js";

const appConfig = window.APP_CONFIG;
if (!appConfig) {
  throw new Error("Missing APP_CONFIG. Create config.local.js from config.example.js before running the app.");
}

const {
  endpoint = "https://cloud.appwrite.io/v1",
  projectId,
  bucketId,
  databaseId,
  collectionId
} = appConfig;

const client = new Client().setEndpoint(endpoint).setProject(projectId);
const account = new Account(client);
const storage = new Storage(client);
const databases = new Databases(client);

const loginBtn = document.getElementById("loginBtn");
const themeToggle = document.getElementById("themeToggle");
const studentTitle = document.getElementById("studentTitle");
const studentSubtitle = document.getElementById("studentSubtitle");
const studentGallery = document.getElementById("studentGallery");

const uploadSection = document.getElementById("uploadSection");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const chooseFileBtn = document.getElementById("chooseFileBtn");
const uploadBtn = document.getElementById("uploadBtn");
const fileName = document.getElementById("fileName");

let currentUser = null;
let selectedFile = null;
let posterItems = [];
let activePosterIndex = -1;

const ICONS = {
  moon: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M21 12.79A9 9 0 1 1 11.21 3a7.5 7.5 0 0 0 9.79 9.79Z\"/></svg>",
  sun: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M12 3v1.5m0 15V21m9-9h-1.5M4.5 12H3m15.364 6.364-1.06-1.06M6.697 6.697l-1.06-1.06m12.727 0-1.06 1.06M6.697 17.303l-1.06 1.06M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z\"/></svg>",
  login: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-7.5a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 6 21h7.5a2.25 2.25 0 0 0 2.25-2.25V15\"/><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"m12 12-3-3m3 3-3 3m3-3H9\"/></svg>",
  logout: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h7.5a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 18 21h-7.5a2.25 2.25 0 0 1-2.25-2.25V15\"/><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"m3 12 3-3m-3 3 3 3m-3-3h12\"/></svg>",
  guest: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M15.75 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 19.5a7.5 7.5 0 0 1 15 0\"/></svg>",
  student: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M3 7.5 12 3l9 4.5-9 4.5L3 7.5Zm3 4.5v4.5c0 .75 2.686 3 6 3s6-2.25 6-3V12\"/></svg>",
  arrowLeft: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M15.75 19.5 8.25 12l7.5-7.5\"/></svg>",
  arrowRight: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"m8.25 4.5 7.5 7.5-7.5 7.5\"/></svg>",
  close: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"m6 6 12 12M18 6 6 18\"/></svg>",
  fullscreen: "<svg class=\"h-3.5 w-3.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M3.75 9V3.75H9m11.25 5.25V3.75H15M3.75 15v5.25H9M15 20.25h5.25V15\"/></svg>",
  external: "<svg class=\"h-3.5 w-3.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M13.5 6H18m0 0v4.5M18 6 10.5 13.5\"/><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M6 9.75A2.25 2.25 0 0 1 8.25 7.5H9m-3 6.75A2.25 2.25 0 0 0 8.25 16.5h7.5A2.25 2.25 0 0 0 18 14.25V12\"/></svg>"
};

function iconLabel(iconSvg, text) {
  return `<span class="inline-flex items-center gap-2">${iconSvg}<span>${text}</span></span>`;
}

const sessionChoice = createSessionChoiceOverlay();
const lightbox = createPosterLightbox();

function createSessionChoiceOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-50 hidden items-center justify-center bg-brand-deep/70 px-4";

  const panel = document.createElement("div");
  panel.className = "w-full max-w-xl rounded-3xl border border-brand-sky/40 bg-brand-paper p-6 shadow-lg dark:border-brand-sky/50 dark:bg-brand-deep";

  const title = document.createElement("h2");
  title.className = "text-xl font-semibold tracking-tight text-brand-deep dark:text-brand-paper";
  title.textContent = "Welcome";

  const subtitle = document.createElement("p");
  subtitle.className = "mt-2 text-sm leading-relaxed text-brand-deep/80 dark:text-brand-mist/85";
  subtitle.textContent = "Choose how you want to continue.";

  const actions = document.createElement("div");
  actions.className = "mt-5 grid gap-3 sm:grid-cols-2";

  const guestButton = document.createElement("button");
  guestButton.type = "button";
  guestButton.className = "rounded-xl border border-brand-sky/60 px-4 py-3 text-sm font-medium text-brand-deep transition hover:bg-brand-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky dark:border-brand-sky dark:text-brand-paper dark:hover:bg-brand-sky/20 dark:focus-visible:ring-brand-mist";
  guestButton.innerHTML = iconLabel(ICONS.guest, "Continue as Guest");

  const studentButton = document.createElement("button");
  studentButton.type = "button";
  studentButton.className = "rounded-xl bg-brand-deep px-4 py-3 text-sm font-medium text-brand-paper transition hover:bg-brand-sky hover:text-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky dark:bg-brand-sky dark:text-brand-deep dark:hover:bg-brand-mist dark:focus-visible:ring-brand-mist";
  studentButton.innerHTML = iconLabel(ICONS.student, "I am a Student");

  const status = document.createElement("p");
  status.className = "mt-4 text-sm text-brand-deep/80 dark:text-brand-mist/85";
  status.setAttribute("aria-live", "polite");

  actions.appendChild(guestButton);
  actions.appendChild(studentButton);
  panel.appendChild(title);
  panel.appendChild(subtitle);
  panel.appendChild(actions);
  panel.appendChild(status);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  studentButton.onclick = () => {
    status.textContent = "Redirecting to student login...";
    account.createOAuth2Session("google", window.location.href, window.location.href);
  };

  guestButton.onclick = async () => {
    guestButton.disabled = true;
    studentButton.disabled = true;
    status.textContent = "Starting guest session...";

    try {
      await account.createAnonymousSession();
      window.location.reload();
    } catch (error) {
      const detail = error && error.message ? error.message : "Unknown error";
      status.textContent = `Could not create guest session: ${detail}`;
      guestButton.disabled = false;
      studentButton.disabled = false;
    }
  };

  return {
    overlay,
    status
  };
}

function showSessionChoiceOverlay() {
  sessionChoice.overlay.classList.remove("hidden");
  sessionChoice.overlay.classList.add("flex");
  sessionChoice.status.textContent = "";
}

function hideSessionChoiceOverlay() {
  sessionChoice.overlay.classList.add("hidden");
  sessionChoice.overlay.classList.remove("flex");
  sessionChoice.status.textContent = "";
}

function createPosterLightbox() {
  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-50 hidden bg-brand-deep/90 p-3 sm:p-6";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Poster viewer");

  const shell = document.createElement("div");
  shell.className = "mx-auto flex h-full w-full max-w-7xl flex-col";

  const controls = document.createElement("div");
  controls.className = "mb-3 flex items-center justify-between gap-2";

  const nav = document.createElement("div");
  nav.className = "flex items-center gap-2";

  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.className = "rounded-xl border border-brand-mist/60 px-3 py-2 text-sm font-medium text-brand-paper transition hover:bg-brand-mist/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mist";
  prevButton.innerHTML = iconLabel(ICONS.arrowLeft, "Previous");
  prevButton.onclick = () => showPosterAtIndex(activePosterIndex - 1);

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "rounded-xl border border-brand-mist/60 px-3 py-2 text-sm font-medium text-brand-paper transition hover:bg-brand-mist/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mist";
  nextButton.innerHTML = iconLabel(ICONS.arrowRight, "Next");
  nextButton.onclick = () => showPosterAtIndex(activePosterIndex + 1);

  nav.appendChild(prevButton);
  nav.appendChild(nextButton);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "rounded-xl border border-brand-mist/60 px-3 py-2 text-sm font-medium text-brand-paper transition hover:bg-brand-mist/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mist";
  closeButton.innerHTML = iconLabel(ICONS.close, "Close");
  closeButton.onclick = closePosterLightbox;

  controls.appendChild(nav);
  controls.appendChild(closeButton);

  const stage = document.createElement("div");
  stage.className = "relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-brand-mist/30 bg-brand-paper/5";

  const image = document.createElement("img");
  image.className = "h-full w-full object-contain p-2 sm:p-4";
  image.alt = "Selected poster";
  image.loading = "eager";

  const pdfFrame = document.createElement("iframe");
  pdfFrame.className = "hidden h-full w-full bg-white";
  pdfFrame.title = "Selected PDF poster";

  const caption = document.createElement("p");
  caption.className = "mt-3 text-sm text-brand-mist/95";

  stage.appendChild(image);
  stage.appendChild(pdfFrame);
  shell.appendChild(controls);
  shell.appendChild(stage);
  shell.appendChild(caption);
  overlay.appendChild(shell);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closePosterLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (overlay.classList.contains("hidden")) return;
    if (event.key === "Escape") closePosterLightbox();
    if (event.key === "ArrowRight") showPosterAtIndex(activePosterIndex + 1);
    if (event.key === "ArrowLeft") showPosterAtIndex(activePosterIndex - 1);
  });

  document.body.appendChild(overlay);

  return {
    overlay,
    image,
    pdfFrame,
    caption,
    prevButton,
    nextButton,
    closeButton
  };
}

function closePosterLightbox() {
  lightbox.overlay.classList.add("hidden");
  lightbox.image.src = "";
  lightbox.pdfFrame.src = "";
  activePosterIndex = -1;
}

function showPosterAtIndex(index) {
  if (!posterItems.length) return;

  const normalizedIndex = (index + posterItems.length) % posterItems.length;
  const poster = posterItems[normalizedIndex];

  activePosterIndex = normalizedIndex;
  lightbox.overlay.classList.remove("hidden");
  if (poster.type === "pdf") {
    lightbox.image.classList.add("hidden");
    lightbox.image.src = "";
    lightbox.pdfFrame.classList.remove("hidden");
    lightbox.pdfFrame.src = `${poster.src}#view=FitH`;
  } else {
    lightbox.pdfFrame.classList.add("hidden");
    lightbox.pdfFrame.src = "";
    lightbox.image.classList.remove("hidden");
    lightbox.image.src = poster.src;
    lightbox.image.alt = poster.alt;
  }
  lightbox.caption.textContent = poster.name;
  lightbox.prevButton.disabled = posterItems.length < 2;
  lightbox.nextButton.disabled = posterItems.length < 2;
  lightbox.closeButton.focus();
}

function isPdfDocument(doc, fileName) {
  const schemaType = String(doc.imageType || "").toLowerCase();
  if (schemaType === "pdf") return true;
  return fileName.toLowerCase().endsWith(".pdf");
}

function setThemeButtonText() {
  if (!themeToggle) return;
  const isDark = document.documentElement.classList.contains("dark");
  themeToggle.innerHTML = isDark ? iconLabel(ICONS.sun, "Light") : iconLabel(ICONS.moon, "Dark");
  themeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
}

function initThemeToggle() {
  if (!themeToggle) return;
  setThemeButtonText();
  themeToggle.onclick = () => {
    document.documentElement.classList.toggle("dark");
    const isDark = document.documentElement.classList.contains("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    setThemeButtonText();
  };
}

function getSchemaImageType(file) {
  const mime = String(file.type || "").toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "application/pdf") return "pdf";

  const name = String(file.name || "").toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".pdf")) return "pdf";

  return null;
}

function setAuthButton() {
  if (currentUser) {
    loginBtn.innerHTML = iconLabel(ICONS.logout, "Log out");
    loginBtn.setAttribute("aria-label", "Log out");
    loginBtn.onclick = async () => {
      await account.deleteSession("current");
      window.location.reload();
    };
    return;
  }

  loginBtn.innerHTML = iconLabel(ICONS.login, "Login");
  loginBtn.setAttribute("aria-label", "Log in with Google");
  loginBtn.onclick = () => {
    account.createOAuth2Session("google", window.location.href, window.location.href);
  };
}

async function checkAuth() {
  try {
    currentUser = await account.get();
  } catch {
    currentUser = null;
  }
  setAuthButton();
}

function bindDropzoneHandlers() {
  chooseFileBtn.onclick = () => fileInput.click();

  fileInput.onchange = () => {
    selectedFile = fileInput.files[0] || null;
    fileName.textContent = selectedFile ? selectedFile.name : "";
  };

  dropzone.ondragover = (event) => {
    event.preventDefault();
    dropzone.classList.add("border-brand-deep", "bg-brand-paper", "dark:border-brand-mist", "dark:bg-brand-sky/20");
  };

  dropzone.ondragleave = () => {
    dropzone.classList.remove("border-brand-deep", "bg-brand-paper", "dark:border-brand-mist", "dark:bg-brand-sky/20");
  };

  dropzone.ondrop = (event) => {
    event.preventDefault();
    dropzone.classList.remove("border-brand-deep", "bg-brand-paper", "dark:border-brand-mist", "dark:bg-brand-sky/20");

    const files = event.dataTransfer?.files;
    selectedFile = files && files.length > 0 ? files[0] : null;
    fileName.textContent = selectedFile ? selectedFile.name : "";
  };
}

async function uploadForStudent(student) {
  if (!currentUser) return alert("Please log in first");

  // Enforce: only the matching student account can upload to this student page.
  if (currentUser.$id !== student.userId) {
    return alert("You can only upload media to your own student page.");
  }

  if (!selectedFile) return alert("Choose or drop a file first.");

  const imageType = getSchemaImageType(selectedFile);
  if (!imageType) {
    return alert("Unsupported file type. Allowed: png, jpg, pdf.");
  }

  let uploadedFileId = null;

  try {
    const ownerPermissions = [
      Permission.read(Role.any()),
      Permission.update(Role.user(currentUser.$id)),
      Permission.delete(Role.user(currentUser.$id))
    ];

    const uploaded = await storage.createFile(
      bucketId,
      ID.unique(),
      selectedFile,
      ownerPermissions
    );
    uploadedFileId = uploaded.$id;

    await databases.createDocument(
      databaseId,
      collectionId,
      ID.unique(),
      {
        imageId: uploaded.$id,
        imageName: selectedFile.name,
        imageType,
        imageSize: selectedFile.size,
        uploadDate: new Date().toISOString(),
        uploadedBy: currentUser.$id,
        approved: true
      },
      ownerPermissions
    );

    selectedFile = null;
    fileInput.value = "";
    fileName.textContent = "";

    await loadStudentGallery(student);
  } catch (error) {
    if (uploadedFileId) {
      try {
        await storage.deleteFile(bucketId, uploadedFileId);
      } catch {
      }
    }

    const detail = error && error.message ? error.message : "Unknown error";
    alert(`Upload failed: ${detail}`);
  }
}

async function loadStudentGallery(student) {
  try {
    const res = await databases.listDocuments(
      databaseId,
      collectionId,
      [
        Query.equal("approved", true),
        Query.equal("uploadedBy", student.userId)
      ]
    );

    studentGallery.innerHTML = "";
    posterItems = [];

    if (res.documents.length === 0) {
      studentGallery.innerHTML = "<p class=\"text-sm text-brand-deep/75 dark:text-brand-mist/80\">No approved uploads for this student yet.</p>";
      return;
    }

    res.documents.forEach((doc) => {
      const imageId = doc.imageId || doc.fileId;
      if (!imageId) return;

      const src = storage.getFileView(bucketId, imageId);
      const posterName = doc.imageName || "Student poster";
      const isPdf = isPdfDocument(doc, posterName);
      const posterAlt = doc.imageName ? `Poster: ${doc.imageName}` : "Student poster";
      const card = document.createElement("article");
      card.className = "group overflow-hidden rounded-2xl border border-brand-sky/40 bg-brand-mist shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow dark:border-brand-sky/50 dark:bg-brand-deep/70";

      const posterIndex = posterItems.length;
      posterItems.push({
        type: isPdf ? "pdf" : "image",
        src,
        alt: posterAlt,
        name: posterName
      });

      if (isPdf) {
        const pdfFrame = document.createElement("iframe");
        pdfFrame.src = `${src}#view=FitH`;
        pdfFrame.className = "h-[32rem] w-full bg-white sm:h-[42rem] lg:h-[52rem]";
        pdfFrame.title = `Preview ${posterName}`;
        pdfFrame.loading = "lazy";
        card.appendChild(pdfFrame);
      } else {
        const img = document.createElement("img");
        img.src = src;
        img.alt = posterAlt;
        img.className = "h-[32rem] w-full object-contain bg-white p-3 sm:h-[42rem] lg:h-[52rem]";
        img.loading = "lazy";
        img.tabIndex = 0;
        img.role = "button";
        img.setAttribute("aria-label", `Open ${posterName} in full-screen viewer`);
        img.onerror = () => card.remove();
        img.onclick = () => showPosterAtIndex(posterIndex);
        img.onkeydown = (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            showPosterAtIndex(posterIndex);
          }
        };
        card.appendChild(img);
      }

      const caption = document.createElement("div");
      caption.className = "flex items-center justify-between gap-3 border-t border-brand-sky/30 bg-brand-paper px-4 py-3 text-sm text-brand-deep/80 dark:border-brand-sky/40 dark:bg-brand-deep/90 dark:text-brand-mist/85";

      const nameText = document.createElement("span");
      nameText.textContent = posterName;

      const openOriginal = document.createElement("a");
      openOriginal.href = src;
      openOriginal.target = "_blank";
      openOriginal.rel = "noreferrer";
      openOriginal.className = "shrink-0 rounded-lg border border-brand-sky/50 px-2.5 py-1.5 text-xs font-medium transition hover:bg-brand-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky dark:border-brand-sky/60 dark:hover:bg-brand-sky/20";
      openOriginal.innerHTML = `${ICONS.external}<span>Open original</span>`;
      openOriginal.classList.add("inline-flex", "items-center", "gap-1.5");

      const openViewer = document.createElement("button");
      openViewer.type = "button";
      openViewer.className = "shrink-0 rounded-lg border border-brand-sky/50 px-2.5 py-1.5 text-xs font-medium transition hover:bg-brand-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky dark:border-brand-sky/60 dark:hover:bg-brand-sky/20";
      openViewer.innerHTML = `${ICONS.fullscreen}<span>Full-screen</span>`;
      openViewer.classList.add("inline-flex", "items-center", "gap-1.5");
      openViewer.onclick = () => showPosterAtIndex(posterIndex);

      caption.appendChild(nameText);
      caption.appendChild(openViewer);
      caption.appendChild(openOriginal);

      card.appendChild(caption);
      studentGallery.appendChild(card);
    });
  } catch (error) {
    const detail = error && error.message ? error.message : "Unknown error";
    studentGallery.innerHTML = `<p class=\"text-sm text-brand-deep/75 dark:text-brand-mist/80\">Could not load student gallery: ${detail}</p>`;
  }
}

async function getStudentFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("student");

  if (!slug) {
    return null;
  }

  return findStudentPageBySlug({
    databases,
    databaseId,
    appConfig,
    slug
  });
}

async function bootstrap() {
  const student = await getStudentFromUrl();

  if (!student) {
    studentTitle.textContent = "Student not found";
    studentSubtitle.textContent = "Use the home page index to open a valid student page.";
    uploadSection.classList.add("hidden");
    studentGallery.innerHTML = "<p class=\"text-sm text-brand-deep/75 dark:text-brand-mist/80\">Invalid student link.</p>";
    return;
  }

  studentTitle.textContent = `${student.name}`;
  studentSubtitle.textContent = `This page is dedicated to ${student.name}'s research.`;

  initThemeToggle();
  await checkAuth();

  if (!currentUser) {
    showSessionChoiceOverlay();
  } else {
    hideSessionChoiceOverlay();
  }

  const currentStudentPage = await resolveCurrentStudentPage({
    account,
    databases,
    databaseId,
    appConfig
  });

  if (currentUser && currentUser.$id === student.userId) {
    uploadSection.classList.remove("hidden");
  } else {
    uploadSection.classList.add("hidden");
  }

  bindDropzoneHandlers();
  uploadBtn.onclick = () => uploadForStudent(student);

  await loadStudentGallery(student);
}

await bootstrap();
