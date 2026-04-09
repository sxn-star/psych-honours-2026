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

const lightbox = createPosterLightbox();

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
  prevButton.textContent = "Previous";
  prevButton.onclick = () => showPosterAtIndex(activePosterIndex - 1);

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "rounded-xl border border-brand-mist/60 px-3 py-2 text-sm font-medium text-brand-paper transition hover:bg-brand-mist/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mist";
  nextButton.textContent = "Next";
  nextButton.onclick = () => showPosterAtIndex(activePosterIndex + 1);

  nav.appendChild(prevButton);
  nav.appendChild(nextButton);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "rounded-xl border border-brand-mist/60 px-3 py-2 text-sm font-medium text-brand-paper transition hover:bg-brand-mist/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mist";
  closeButton.textContent = "Close";
  closeButton.onclick = closePosterLightbox;

  controls.appendChild(nav);
  controls.appendChild(closeButton);

  const stage = document.createElement("div");
  stage.className = "relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-brand-mist/30 bg-brand-paper/5";

  const image = document.createElement("img");
  image.className = "h-full w-full object-contain p-2 sm:p-4";
  image.alt = "Selected poster";
  image.loading = "eager";

  const caption = document.createElement("p");
  caption.className = "mt-3 text-sm text-brand-mist/95";

  stage.appendChild(image);
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
    caption,
    prevButton,
    nextButton,
    closeButton
  };
}

function closePosterLightbox() {
  lightbox.overlay.classList.add("hidden");
  lightbox.image.src = "";
  activePosterIndex = -1;
}

function showPosterAtIndex(index) {
  if (!posterItems.length) return;

  const normalizedIndex = (index + posterItems.length) % posterItems.length;
  const poster = posterItems[normalizedIndex];

  activePosterIndex = normalizedIndex;
  lightbox.overlay.classList.remove("hidden");
  lightbox.image.src = poster.src;
  lightbox.image.alt = poster.alt;
  lightbox.caption.textContent = poster.name;
  lightbox.prevButton.disabled = posterItems.length < 2;
  lightbox.nextButton.disabled = posterItems.length < 2;
  lightbox.closeButton.focus();
}

function setThemeButtonText() {
  if (!themeToggle) return;
  const isDark = document.documentElement.classList.contains("dark");
  themeToggle.textContent = isDark ? "Light" : "Dark";
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
    loginBtn.textContent = "Log out";
    loginBtn.setAttribute("aria-label", "Log out");
    loginBtn.onclick = async () => {
      await account.deleteSession("current");
      window.location.reload();
    };
    return;
  }

  loginBtn.textContent = "Login";
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
      const posterAlt = doc.imageName ? `Poster: ${doc.imageName}` : "Student poster";
      const card = document.createElement("article");
      card.className = "group overflow-hidden rounded-2xl border border-brand-sky/40 bg-brand-mist shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow dark:border-brand-sky/50 dark:bg-brand-deep/70";

      const img = document.createElement("img");
      img.src = src;
      img.alt = posterAlt;
      img.className = "h-[32rem] w-full object-contain bg-white p-3 sm:h-[42rem] lg:h-[52rem]";
      img.loading = "lazy";
      img.tabIndex = 0;
      img.role = "button";
      img.setAttribute("aria-label", `Open ${posterName} in full-screen viewer`);
      img.onerror = () => card.remove();

      const posterIndex = posterItems.length;
      posterItems.push({
        src,
        alt: posterAlt,
        name: posterName
      });

      img.onclick = () => showPosterAtIndex(posterIndex);
      img.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showPosterAtIndex(posterIndex);
        }
      };

      const caption = document.createElement("div");
      caption.className = "flex items-center justify-between gap-3 border-t border-brand-sky/30 bg-brand-paper px-4 py-3 text-sm text-brand-deep/80 dark:border-brand-sky/40 dark:bg-brand-deep/90 dark:text-brand-mist/85";

      const nameText = document.createElement("span");
      nameText.textContent = posterName;

      const openOriginal = document.createElement("a");
      openOriginal.href = src;
      openOriginal.target = "_blank";
      openOriginal.rel = "noreferrer";
      openOriginal.className = "shrink-0 rounded-lg border border-brand-sky/50 px-2.5 py-1.5 text-xs font-medium transition hover:bg-brand-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky dark:border-brand-sky/60 dark:hover:bg-brand-sky/20";
      openOriginal.textContent = "Open original";

      caption.appendChild(nameText);
      caption.appendChild(openOriginal);

      card.appendChild(img);
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

  const currentStudentPage = await resolveCurrentStudentPage({
    account,
    databases,
    databaseId,
    appConfig
  });

  if (currentUser && currentStudentPage && currentStudentPage.slug !== student.slug) {
    window.location.replace(`student.html?student=${encodeURIComponent(currentStudentPage.slug)}`);
    return;
  }

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
