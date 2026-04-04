import { Client, Account, Storage, Databases, ID, Query, Permission, Role } from "https://cdn.jsdelivr.net/npm/appwrite@13.0.0/+esm";
import {
  students,
  canAutoCreateStudentPage,
  buildAutoStudentPage,
  isAdminAccount,
  getStudentPagesCollectionId,
  normalizeStudentPageDocument
} from "./students.js";

const appConfig = window.APP_CONFIG;
if (!appConfig) {
  throw new Error("Missing APP_CONFIG. Create runtime-config.js from config.example.js before running the app.");
}

const {
  endpoint = "https://cloud.appwrite.io/v1",
  projectId,
  bucketId,
  databaseId,
  collectionId: uploadsCollectionId,
  studentsTeamId = ""
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
let currentSession = null;
let currentStudentPage = null;
let selectedFile = null;
let studentPages = students;

function getStudentReadPermission() {
  const normalizedTeamId = String(studentsTeamId || "").trim();
  return normalizedTeamId
    ? Permission.read(Role.team(normalizedTeamId))
    : Permission.read(Role.any());
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
    const [user, session] = await Promise.all([
      account.get(),
      account.getSession("current")
    ]);

    currentUser = user;
    currentSession = session;
  } catch {
    currentUser = null;
    currentSession = null;
  }
  setAuthButton();
}

async function ensureStudentPage(user, session) {
  if (!canAutoCreateStudentPage(user, session)) return null;

  try {
    const prefs = await account.getPrefs();
    const existingPage = prefs?.studentPage;

    if (existingPage && existingPage.userId === user.$id && existingPage.slug) {
      return existingPage;
    }

    const autoPage = buildAutoStudentPage(user);
    await account.updatePrefs({
      ...prefs,
      studentPage: autoPage
    });

    await upsertStudentPageDocument(autoPage);

    return autoPage;
  } catch {
    return null;
  }
}

async function upsertStudentPageDocument(page) {
  const studentPagesCollectionId = getStudentPagesCollectionId();
  if (!databaseId || !studentPagesCollectionId || !page?.userId) return;

  const permissions = [
    getStudentReadPermission(),
    Permission.update(Role.user(page.userId)),
    Permission.delete(Role.user(page.userId))
  ];

  try {
    await databases.getDocument(databaseId, studentPagesCollectionId, page.userId);
    await databases.updateDocument(databaseId, studentPagesCollectionId, page.userId, page, permissions);
  } catch (error) {
    const statusCode = error?.code || error?.status || 0;
    if (statusCode === 404) {
      await databases.createDocument(databaseId, studentPagesCollectionId, page.userId, page, permissions);
      return;
    }

    throw error;
  }
}

function normalizeCatalogPages(pages) {
  const bySlug = new Map();

  pages.forEach((page) => {
    const normalizedPage = normalizeStudentPageDocument(page);
    if (!normalizedPage) return;
    bySlug.set(normalizedPage.slug, normalizedPage);
  });

  return [...bySlug.values()].sort((left, right) => left.name.localeCompare(right.name));
}

async function loadStudentPages() {
  const studentPagesCollectionId = getStudentPagesCollectionId();

  if (!databaseId || !studentPagesCollectionId) {
    return normalizeCatalogPages(currentStudentPage ? [currentStudentPage, ...students] : students);
  }

  try {
    const response = await databases.listDocuments(databaseId, studentPagesCollectionId, [Query.limit(100)]);
    const appwritePages = response.documents
      .map(normalizeStudentPageDocument)
      .filter(Boolean);

    const mergedPages = appwritePages.length > 0 ? appwritePages : students;

    if (currentStudentPage) {
      const hasPersonalPage = mergedPages.some((page) => page.userId === currentStudentPage.userId);
      if (!hasPersonalPage) {
        mergedPages.unshift(currentStudentPage);
      }
    }

    return normalizeCatalogPages(mergedPages);
  } catch {
    return normalizeCatalogPages(currentStudentPage ? [currentStudentPage, ...students] : students);
  }
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
      getStudentReadPermission(),
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
      uploadsCollectionId,
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
      uploadsCollectionId,
      [
        Query.equal("approved", true),
        Query.equal("uploadedBy", student.userId)
      ]
    );

    studentGallery.innerHTML = "";

    if (res.documents.length === 0) {
      studentGallery.innerHTML = "<p class=\"text-sm text-brand-deep/75 dark:text-brand-mist/80\">No approved uploads for this student yet.</p>";
      return;
    }

    res.documents.forEach((doc) => {
      const imageId = doc.imageId || doc.fileId;
      if (!imageId) return;

      const img = document.createElement("img");
      img.src = storage.getFileView(bucketId, imageId);
      img.alt = doc.imageName ? `Upload: ${doc.imageName}` : "Student upload";
      img.className = "aspect-square w-full rounded-xl border border-brand-sky/40 object-cover shadow-sm transition-all duration-200 ease-out hover:scale-[1.01] hover:shadow dark:border-brand-sky/50";
      img.onerror = () => img.remove();
      studentGallery.appendChild(img);
    });
  } catch (error) {
    const detail = error && error.message ? error.message : "Unknown error";
    studentGallery.innerHTML = `<p class=\"text-sm text-brand-deep/75 dark:text-brand-mist/80\">Could not load student gallery: ${detail}</p>`;
  }
}

async function bootstrap() {
  const requestedSlug = new URLSearchParams(window.location.search).get("student");
  await checkAuth();

  const personalStudent = currentUser ? await ensureStudentPage(currentUser, currentSession) : null;
  currentStudentPage = personalStudent;
  studentPages = await loadStudentPages();

  const urlStudent = requestedSlug ? studentPages.find((page) => page.slug === requestedSlug) || null : null;
  let student = urlStudent;

  if (!student && personalStudent) {
    const shouldUsePersonalPage = !requestedSlug || requestedSlug === "me" || requestedSlug === personalStudent.slug;
    if (shouldUsePersonalPage) {
      student = personalStudent;
    }
  }

  if (!student) {
    studentTitle.textContent = "Student not found";
    if (currentUser && isAdminAccount(currentUser)) {
      studentSubtitle.textContent = "You can log in, but this account is configured as admin-only and does not receive a personal student page.";
    } else if (currentUser) {
      studentSubtitle.textContent = "This login is not eligible for automatic page creation. Use the home page index to open a valid student page.";
    } else {
      studentSubtitle.textContent = "Use the home page index to open a valid student page.";
    }
    uploadSection.classList.add("hidden");
    studentGallery.innerHTML = "<p class=\"text-sm text-brand-deep/75 dark:text-brand-mist/80\">Invalid student link.</p>";
    return;
  }

  studentTitle.textContent = `${student.name} — Media Page`;
  studentSubtitle.textContent = `This page is dedicated to ${student.name}.`;

  initThemeToggle();

  if (currentUser && currentUser.$id === student.userId && !isAdminAccount(currentUser)) {
    uploadSection.classList.remove("hidden");
  } else {
    uploadSection.classList.add("hidden");
  }

  bindDropzoneHandlers();
  uploadBtn.onclick = () => uploadForStudent(student);

  await loadStudentGallery(student);
}

await bootstrap();
