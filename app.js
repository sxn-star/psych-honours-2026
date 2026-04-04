import { Client, Account, Databases, Query, Permission, Role } from "https://cdn.jsdelivr.net/npm/appwrite@13.0.0/+esm";
import {
  students,
  canAutoCreateStudentPage,
  buildAutoStudentPage,
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
  databaseId,
  studentsTeamId = ""
} = appConfig;

if (!projectId) {
  throw new Error("APP_CONFIG is incomplete. Set projectId in runtime-config.js");
}

const client = new Client().setEndpoint(endpoint).setProject(projectId);
const account = new Account(client);
const databases = new Databases(client);

const loginBtn = document.getElementById("loginBtn");
const themeToggle = document.getElementById("themeToggle");
const searchInput = document.getElementById("studentSearch");
const studentLinks = document.getElementById("studentLinks");

let currentUser = null;
let currentSession = null;
let currentStudentPage = null;
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

function setAuthButton() {
  if (!loginBtn) return;

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

  currentStudentPage = await ensureStudentPage();
  studentPages = await loadStudentPages();
  setAuthButton();
}

async function ensureStudentPage() {
  if (!currentUser || !currentSession) return null;
  if (!canAutoCreateStudentPage(currentUser, currentSession)) return null;

  try {
    const prefs = await account.getPrefs();
    const existingPage = prefs?.studentPage;

    if (existingPage && existingPage.userId === currentUser.$id && existingPage.slug) {
      return existingPage;
    }

    const autoPage = buildAutoStudentPage(currentUser);
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
    if (!page?.slug || !page?.userId) return;
    bySlug.set(page.slug, page);
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

function renderStudentIndex(filterText = "") {
  if (!studentLinks) return;

  const normalizedFilter = filterText.trim().toLowerCase();
  const catalog = studentPages;

  const filtered = catalog.filter((student) =>
    student.name.toLowerCase().includes(normalizedFilter)
  );

  studentLinks.innerHTML = "";

  if (filtered.length === 0) {
    studentLinks.innerHTML = "<p class=\"text-sm leading-relaxed text-brand-deep/75 dark:text-brand-mist/80\">No matching student pages found.</p>";
    return;
  }

  filtered.forEach((student) => {
    const link = document.createElement("a");
    const isPersonalPage = currentStudentPage && student.slug === currentStudentPage.slug;
    link.href = `student.html?student=${encodeURIComponent(student.slug)}`;
    link.textContent = isPersonalPage ? `${student.name} (your page)` : student.name;
    link.className = "mb-2 block rounded-xl border border-brand-sky/40 bg-brand-paper px-4 py-3.5 text-[15px] font-medium leading-6 text-brand-deep shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-brand-mist hover:shadow focus:outline-none focus:ring-2 focus:ring-brand-sky focus:ring-offset-1 dark:border-brand-sky/50 dark:bg-brand-deep/80 dark:text-brand-paper dark:hover:bg-brand-sky/20 dark:focus:ring-brand-mist dark:focus:ring-offset-brand-deep";
    studentLinks.appendChild(link);
  });
}

if (searchInput) {
  searchInput.addEventListener("input", (event) => {
    renderStudentIndex(event.target.value);
  });
}

initThemeToggle();
await checkAuth();
renderStudentIndex();
