import { Client, Account, Databases } from "https://cdn.jsdelivr.net/npm/appwrite@13.0.0/+esm";
import { claimStudentPageForUser, listStudentPages, resolveCurrentStudentPage } from "./student-pages.js";

const appConfig = window.APP_CONFIG;
if (!appConfig) {
  throw new Error("Missing APP_CONFIG. Create config.local.js from config.example.js before running the app.");
}

const {
  endpoint = "https://cloud.appwrite.io/v1",
  projectId,
  databaseId
} = appConfig;

if (!projectId) {
  throw new Error("APP_CONFIG is incomplete. Set projectId in config.local.js");
}

const client = new Client().setEndpoint(endpoint).setProject(projectId);
const account = new Account(client);
const databases = new Databases(client);

const loginBtn = document.getElementById("loginBtn");
const themeToggle = document.getElementById("themeToggle");
const searchInput = document.getElementById("studentSearch");
const studentLinks = document.getElementById("studentLinks");
const onboardingSection = document.getElementById("onboardingSection");
const onboardingForm = document.getElementById("onboardingForm");
const fullNameInput = document.getElementById("fullNameInput");
const onboardingStatus = document.getElementById("onboardingStatus");

let currentUser = null;
let currentStudentPage = null;
let studentPages = [];
let isRedirecting = false;

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

function setOnboardingState(visible, message = "") {
  if (onboardingSection) {
    onboardingSection.classList.toggle("hidden", !visible);
  }

  if (onboardingStatus) {
    onboardingStatus.textContent = message;
  }

  if (visible && fullNameInput && currentUser?.name && !fullNameInput.value.trim()) {
    fullNameInput.value = currentUser.name;
  }
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
    currentUser = await account.get();
  } catch {
    currentUser = null;
  }
  setAuthButton();
}

function renderStudentIndex(filterText = "") {
  if (!studentLinks) return;

  const normalizedFilter = filterText.trim().toLowerCase();
  const filtered = studentPages.filter((student) => student.name.toLowerCase().includes(normalizedFilter));

  studentLinks.innerHTML = "";

  if (filtered.length === 0) {
    studentLinks.innerHTML = "<p class=\"text-sm leading-relaxed text-brand-deep/75 dark:text-brand-mist/80\">No matching student pages found.</p>";
    return;
  }

  filtered.forEach((student) => {
    const link = document.createElement("a");
    link.href = `student.html?student=${encodeURIComponent(student.slug)}`;
    link.textContent = student.name;
    link.className = "mb-2 block rounded-xl border border-brand-sky/40 bg-brand-paper px-4 py-3.5 text-[15px] font-medium leading-6 text-brand-deep shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-brand-mist hover:shadow focus:outline-none focus:ring-2 focus:ring-brand-sky focus:ring-offset-1 dark:border-brand-sky/50 dark:bg-brand-deep/80 dark:text-brand-paper dark:hover:bg-brand-sky/20 dark:focus:ring-brand-mist dark:focus:ring-offset-brand-deep";
    studentLinks.appendChild(link);
  });
}

async function loadStudentIndexPages() {
  studentPages = await listStudentPages({
    databases,
    databaseId,
    appConfig
  });
}

async function routeLoggedInUser() {
  currentStudentPage = await resolveCurrentStudentPage({
    account,
    databases,
    databaseId,
    appConfig
  });

  if (currentStudentPage) {
    isRedirecting = true;
    setOnboardingState(false, "");
    window.location.replace(`student.html?student=${encodeURIComponent(currentStudentPage.slug)}`);
    return true;
  }

  if (currentUser && appConfig.studentPagesCollectionId) {
    setOnboardingState(true, "Enter your full name once to create your page.");
  } else {
    setOnboardingState(false, "");
  }

  return false;
}

function bindOnboardingForm() {
  if (!onboardingForm || !fullNameInput) return;

  onboardingForm.onsubmit = async (event) => {
    event.preventDefault();

    if (!currentUser) {
      setOnboardingState(true, "Please log in first.");
      return;
    }

    const fullName = fullNameInput.value;
    if (!fullName.trim()) {
      setOnboardingState(true, "Enter your full name to continue.");
      fullNameInput.focus();
      return;
    }

    if (onboardingStatus) {
      onboardingStatus.textContent = "Creating your page...";
    }

    try {
      const studentPage = await claimStudentPageForUser({
        account,
        databases,
        databaseId,
        appConfig,
        fullName
      });

      isRedirecting = true;
      window.location.replace(`student.html?student=${encodeURIComponent(studentPage.slug)}`);
    } catch (error) {
      const detail = error && error.message ? error.message : "Unknown error";
      setOnboardingState(true, `Could not create your page: ${detail}`);
    }
  };
}

async function bootstrap() {
  initThemeToggle();
  bindOnboardingForm();

  await checkAuth();
  await loadStudentIndexPages();

  if (currentUser) {
    const didRedirect = await routeLoggedInUser();
    if (didRedirect || isRedirecting) {
      return;
    }
  } else {
    setOnboardingState(false, "");
  }

  renderStudentIndex();
}

if (searchInput) {
  searchInput.addEventListener("input", (event) => {
    renderStudentIndex(event.target.value);
  });
}

await bootstrap();
