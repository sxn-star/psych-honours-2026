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

const ICONS = {
  moon: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M21 12.79A9 9 0 1 1 11.21 3a7.5 7.5 0 0 0 9.79 9.79Z\"/></svg>",
  sun: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M12 3v1.5m0 15V21m9-9h-1.5M4.5 12H3m15.364 6.364-1.06-1.06M6.697 6.697l-1.06-1.06m12.727 0-1.06 1.06M6.697 17.303l-1.06 1.06M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z\"/></svg>",
  login: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-7.5a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 6 21h7.5a2.25 2.25 0 0 0 2.25-2.25V15\"/><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"m12 12-3-3m3 3-3 3m3-3H9\"/></svg>",
  logout: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h7.5a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 18 21h-7.5a2.25 2.25 0 0 1-2.25-2.25V15\"/><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"m3 12 3-3m-3 3 3 3m-3-3h12\"/></svg>",
  guest: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M15.75 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 19.5a7.5 7.5 0 0 1 15 0\"/></svg>",
  student: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M3 7.5 12 3l9 4.5-9 4.5L3 7.5Zm3 4.5v4.5c0 .75 2.686 3 6 3s6-2.25 6-3V12\"/></svg>",
  page: "<svg class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M15.75 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 19.5a7.5 7.5 0 0 1 15 0\"/></svg>"
};

function iconLabel(iconSvg, text) {
  return `<span class="inline-flex items-center gap-2">${iconSvg}<span>${text}</span></span>`;
}

const sessionChoice = createSessionChoiceOverlay();

function isGuestUser(user) {
  return Boolean(user) && !String(user.email || "").trim();
}

function isStudentUser(user) {
  return Boolean(user) && !isGuestUser(user);
}

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

  return {
    overlay,
    guestButton,
    studentButton,
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

function bindSessionChoice() {
  sessionChoice.studentButton.onclick = () => {
    sessionChoice.status.textContent = "Redirecting to student login...";
    account.createOAuth2Session("google", window.location.href, window.location.href);
  };

  sessionChoice.guestButton.onclick = async () => {
    sessionChoice.guestButton.disabled = true;
    sessionChoice.studentButton.disabled = true;
    sessionChoice.status.textContent = "Starting guest session...";

    try {
      await account.createAnonymousSession();
      window.location.reload();
    } catch (error) {
      const detail = error && error.message ? error.message : "Unknown error";
      sessionChoice.status.textContent = `Could not create guest session: ${detail}`;
      sessionChoice.guestButton.disabled = false;
      sessionChoice.studentButton.disabled = false;
    }
  };
}

function setThemeButtonText() {
  if (!themeToggle) return;
  const isDark = document.documentElement.classList.contains("dark");
  themeToggle.innerHTML = isDark ? ICONS.sun : ICONS.moon;
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
    link.innerHTML = `${ICONS.page}<span>${student.name}</span>`;
    link.className = "mb-2 flex items-center gap-2 rounded-xl border border-brand-sky/40 bg-brand-paper px-4 py-3.5 text-[15px] font-medium leading-6 text-brand-deep shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-brand-mist hover:shadow focus:outline-none focus:ring-2 focus:ring-brand-sky focus:ring-offset-1 dark:border-brand-sky/50 dark:bg-brand-deep/80 dark:text-brand-paper dark:hover:bg-brand-sky/20 dark:focus:ring-brand-mist dark:focus:ring-offset-brand-deep";
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
    setOnboardingState(false, "");
    return false;
  }

  if (isStudentUser(currentUser) && appConfig.studentPagesCollectionId) {
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
  bindSessionChoice();

  await checkAuth();

  if (!currentUser) {
    showSessionChoiceOverlay();
  } else {
    hideSessionChoiceOverlay();
  }

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
