import { Client, Account, Databases, ID } from "https://cdn.jsdelivr.net/npm/appwrite@13.0.0/+esm";
import { claimStudentPageForUser, getAllowedEmailDomain, isAllowedEmailForDomain, listStudentPages, resolveCurrentStudentPage } from "./student-pages.js";

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
const welcomeRotator = document.getElementById("welcomeRotator");

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

function revealElements(root = document) {
  const elements = root.querySelectorAll(".pop-reveal:not(.is-visible)");
  if (elements.length === 0) return;
  requestAnimationFrame(() => {
    elements.forEach((element) => element.classList.add("is-visible"));
  });
}

function initWelcomeRotator() {
  if (!welcomeRotator) return;
  const messages = [
    "Discover emerging student psychology research.",
    "Browse posters, methods, and findings from this cohort.",
    "Tap any name to step into their research story."
  ];

  let index = 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  welcomeRotator.textContent = messages[index];

  if (reduceMotion || messages.length < 2) return;

  setInterval(() => {
    index = (index + 1) % messages.length;
    welcomeRotator.classList.add("opacity-0", "translate-y-1");
    setTimeout(() => {
      welcomeRotator.textContent = messages[index];
      welcomeRotator.classList.remove("opacity-0", "translate-y-1");
    }, 220);
  }, 4200);
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

  const studentAuthWrap = document.createElement("div");
  studentAuthWrap.className = "mt-4 hidden rounded-2xl border border-brand-sky/40 bg-brand-mist/60 p-4 dark:border-brand-sky/50 dark:bg-brand-deep/60";

  const studentAuthTitle = document.createElement("h3");
  studentAuthTitle.className = "text-sm font-semibold tracking-tight text-brand-deep dark:text-brand-paper";
  studentAuthTitle.textContent = "Student Sign In";

  const studentAuthHint = document.createElement("p");
  studentAuthHint.className = "mt-1 text-xs text-brand-deep/75 dark:text-brand-mist/80";
  studentAuthHint.textContent = "Use your student email and password.";

  const nameLabel = document.createElement("label");
  nameLabel.className = "mt-3 block text-xs font-medium text-brand-deep/80 dark:text-brand-mist/85";
  nameLabel.textContent = "Full name (only for sign up)";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "mt-1 w-full rounded-lg border border-brand-sky/40 bg-brand-paper px-3 py-2 text-sm text-brand-deep outline-none transition focus:border-brand-sky focus:ring-2 focus:ring-brand-sky/40 dark:border-brand-sky/50 dark:bg-brand-deep dark:text-brand-paper";
  nameInput.placeholder = "Jane Student";

  const emailLabel = document.createElement("label");
  emailLabel.className = "mt-3 block text-xs font-medium text-brand-deep/80 dark:text-brand-mist/85";
  emailLabel.textContent = "Email";

  const emailInput = document.createElement("input");
  emailInput.type = "email";
  emailInput.autocomplete = "email";
  emailInput.required = true;
  emailInput.className = "mt-1 w-full rounded-lg border border-brand-sky/40 bg-brand-paper px-3 py-2 text-sm text-brand-deep outline-none transition focus:border-brand-sky focus:ring-2 focus:ring-brand-sky/40 dark:border-brand-sky/50 dark:bg-brand-deep dark:text-brand-paper";
  emailInput.placeholder = "student@example.org";

  const passwordLabel = document.createElement("label");
  passwordLabel.className = "mt-3 block text-xs font-medium text-brand-deep/80 dark:text-brand-mist/85";
  passwordLabel.textContent = "Password";

  const passwordInput = document.createElement("input");
  passwordInput.type = "password";
  passwordInput.autocomplete = "current-password";
  passwordInput.required = true;
  passwordInput.minLength = 8;
  passwordInput.className = "mt-1 w-full rounded-lg border border-brand-sky/40 bg-brand-paper px-3 py-2 text-sm text-brand-deep outline-none transition focus:border-brand-sky focus:ring-2 focus:ring-brand-sky/40 dark:border-brand-sky/50 dark:bg-brand-deep dark:text-brand-paper";
  passwordInput.placeholder = "At least 8 characters";

  const studentAuthActions = document.createElement("div");
  studentAuthActions.className = "mt-4 flex flex-wrap gap-2";

  const signInButton = document.createElement("button");
  signInButton.type = "button";
  signInButton.className = "rounded-lg bg-brand-deep px-3 py-2 text-sm font-medium text-brand-paper transition hover:bg-brand-sky hover:text-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky dark:bg-brand-sky dark:text-brand-deep dark:hover:bg-brand-mist";
  signInButton.textContent = "Sign in";

  const signUpButton = document.createElement("button");
  signUpButton.type = "button";
  signUpButton.className = "rounded-lg border border-brand-sky/50 px-3 py-2 text-sm font-medium text-brand-deep transition hover:bg-brand-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky dark:border-brand-sky/60 dark:text-brand-paper dark:hover:bg-brand-sky/20";
  signUpButton.textContent = "Create account";

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-brand-deep/80 transition hover:border-brand-sky/40 hover:bg-brand-paper/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky dark:text-brand-mist/85 dark:hover:bg-brand-sky/20";
  backButton.textContent = "Back";

  studentAuthActions.appendChild(signInButton);
  studentAuthActions.appendChild(signUpButton);
  studentAuthActions.appendChild(backButton);

  studentAuthWrap.appendChild(studentAuthTitle);
  studentAuthWrap.appendChild(studentAuthHint);
  studentAuthWrap.appendChild(nameLabel);
  studentAuthWrap.appendChild(nameInput);
  studentAuthWrap.appendChild(emailLabel);
  studentAuthWrap.appendChild(emailInput);
  studentAuthWrap.appendChild(passwordLabel);
  studentAuthWrap.appendChild(passwordInput);
  studentAuthWrap.appendChild(studentAuthActions);

  const status = document.createElement("p");
  status.className = "mt-4 text-sm text-brand-deep/80 dark:text-brand-mist/85";
  status.setAttribute("aria-live", "polite");

  actions.appendChild(guestButton);
  actions.appendChild(studentButton);
  panel.appendChild(title);
  panel.appendChild(subtitle);
  panel.appendChild(actions);
  panel.appendChild(studentAuthWrap);
  panel.appendChild(status);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  return {
    overlay,
    guestButton,
    studentButton,
    status,
    studentAuthWrap,
    signInButton,
    signUpButton,
    backButton,
    nameInput,
    emailInput,
    passwordInput
  };
}

function showSessionChoiceOverlay() {
  sessionChoice.overlay.classList.remove("hidden");
  sessionChoice.overlay.classList.add("flex");
  sessionChoice.studentAuthWrap.classList.add("hidden");
  sessionChoice.guestButton.classList.remove("hidden");
  sessionChoice.studentButton.classList.remove("hidden");
  sessionChoice.nameInput.value = "";
  sessionChoice.emailInput.value = "";
  sessionChoice.passwordInput.value = "";
  sessionChoice.status.textContent = "";
}

function hideSessionChoiceOverlay() {
  sessionChoice.overlay.classList.add("hidden");
  sessionChoice.overlay.classList.remove("flex");
  sessionChoice.status.textContent = "";
}

function bindSessionChoice() {
  const setStudentAuthBusy = (busy) => {
    sessionChoice.guestButton.disabled = busy;
    sessionChoice.studentButton.disabled = busy;
    sessionChoice.signInButton.disabled = busy;
    sessionChoice.signUpButton.disabled = busy;
    sessionChoice.backButton.disabled = busy;
    sessionChoice.emailInput.disabled = busy;
    sessionChoice.passwordInput.disabled = busy;
    sessionChoice.nameInput.disabled = busy;
  };

  const startStudentAuth = () => {
    sessionChoice.studentAuthWrap.classList.remove("hidden");
    sessionChoice.guestButton.classList.add("hidden");
    sessionChoice.studentButton.classList.add("hidden");
    sessionChoice.status.textContent = "";
    sessionChoice.emailInput.focus();
  };

  const resetToChoice = () => {
    sessionChoice.studentAuthWrap.classList.add("hidden");
    sessionChoice.guestButton.classList.remove("hidden");
    sessionChoice.studentButton.classList.remove("hidden");
    sessionChoice.status.textContent = "";
  };

  const completeStudentAuth = async (mode) => {
    const email = sessionChoice.emailInput.value.trim().toLowerCase();
    const password = sessionChoice.passwordInput.value;
    const fullName = sessionChoice.nameInput.value.trim();

    if (!email || !password) {
      sessionChoice.status.textContent = "Enter both email and password.";
      return;
    }

    if (!isAllowedEmailForDomain(email, appConfig)) {
      const allowedDomain = getAllowedEmailDomain(appConfig);
      sessionChoice.status.textContent = allowedDomain
        ? `Use your @${allowedDomain} email for student access.`
        : "This email is not allowed for student access.";
      return;
    }

    if (mode === "signup" && !fullName) {
      sessionChoice.status.textContent = "Enter your full name to create your account.";
      sessionChoice.nameInput.focus();
      return;
    }

    if (password.length < 8) {
      sessionChoice.status.textContent = "Password must be at least 8 characters.";
      return;
    }

    setStudentAuthBusy(true);
    sessionChoice.status.textContent = mode === "signin" ? "Signing in..." : "Creating account...";

    try {
      if (mode === "signup") {
        await account.create(ID.unique(), email, password, fullName || "Student");
      }

      await account.createEmailPasswordSession(email, password);
      window.location.reload();
    } catch (error) {
      const detail = error && error.message ? error.message : "Unknown error";
      sessionChoice.status.textContent = detail;
      setStudentAuthBusy(false);
    }
  };

  sessionChoice.studentButton.onclick = () => {
    startStudentAuth();
  };

  sessionChoice.signInButton.onclick = () => completeStudentAuth("signin");
  sessionChoice.signUpButton.onclick = () => completeStudentAuth("signup");
  sessionChoice.backButton.onclick = resetToChoice;

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
  loginBtn.setAttribute("aria-label", "Log in");
  loginBtn.onclick = () => {
    showSessionChoiceOverlay();
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

async function rejectDisallowedSession() {
  if (!currentUser || isAllowedEmailForDomain(currentUser.email, appConfig)) {
    return false;
  }

  const blockedEmail = String(currentUser.email || "").trim();
  try {
    await account.deleteSession("current");
  } catch {
  }

  currentUser = null;
  setAuthButton();
  showSessionChoiceOverlay();

  const allowedDomain = getAllowedEmailDomain(appConfig);
  if (sessionChoice.status) {
    sessionChoice.status.textContent = allowedDomain
      ? `${blockedEmail} is not allowed here. Use an @${allowedDomain} account to create or upload content.`
      : `${blockedEmail} is not allowed here.`;
  }

  return true;
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
    link.className = "pop-reveal tilt-lift mb-2 flex items-center gap-2 rounded-xl border border-brand-sky/40 bg-brand-paper px-4 py-3.5 text-[15px] font-medium leading-6 text-brand-deep shadow-sm transition-all duration-200 ease-out hover:bg-brand-mist hover:shadow focus:outline-none focus:ring-2 focus:ring-brand-sky focus:ring-offset-1 dark:border-brand-sky/50 dark:bg-brand-deep/80 dark:text-brand-paper dark:hover:bg-brand-sky/20 dark:focus:ring-brand-mist dark:focus:ring-offset-brand-deep";
    link.style.setProperty("--reveal-delay", `${Math.min(30 + (studentLinks.children.length * 40), 420)}ms`);
    studentLinks.appendChild(link);
  });

  revealElements(studentLinks);
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
  initWelcomeRotator();
  bindOnboardingForm();
  bindSessionChoice();

  await checkAuth();
	const wasRejected = await rejectDisallowedSession();

  if (!currentUser) {
    if (!wasRejected) {
      showSessionChoiceOverlay();
    }
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
  revealElements(document);
}

if (searchInput) {
  searchInput.addEventListener("input", (event) => {
    renderStudentIndex(event.target.value);
  });
}

await bootstrap();
