import { Client, Account } from "https://cdn.jsdelivr.net/npm/appwrite@13.0.0/+esm";
import { students } from "./students.js";

const appConfig = window.APP_CONFIG;
if (!appConfig) {
  throw new Error("Missing APP_CONFIG. Create config.local.js from config.example.js before running the app.");
}

const {
  endpoint = "https://cloud.appwrite.io/v1",
  projectId
} = appConfig;

if (!projectId) {
  throw new Error("APP_CONFIG is incomplete. Set projectId in config.local.js");
}

const client = new Client().setEndpoint(endpoint).setProject(projectId);
const account = new Account(client);

const loginBtn = document.getElementById("loginBtn");
const themeToggle = document.getElementById("themeToggle");
const searchInput = document.getElementById("studentSearch");
const studentLinks = document.getElementById("studentLinks");

let currentUser = null;

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
    currentUser = await account.get();
  } catch {
    currentUser = null;
  }
  setAuthButton();
}

function renderStudentIndex(filterText = "") {
  if (!studentLinks) return;

  const normalizedFilter = filterText.trim().toLowerCase();
  const filtered = students.filter((student) =>
    student.name.toLowerCase().includes(normalizedFilter)
  );

  studentLinks.innerHTML = "";

  if (filtered.length === 0) {
    studentLinks.innerHTML = "<p class=\"text-sm leading-relaxed text-gray-500 dark:text-gray-400\">No matching student pages found.</p>";
    return;
  }

  filtered.forEach((student) => {
    const link = document.createElement("a");
    link.href = `student.html?student=${encodeURIComponent(student.slug)}`;
    link.textContent = student.name;
    link.className = "mb-2 block rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-[15px] font-medium leading-6 text-gray-800 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow focus:outline-none focus:ring-2 focus:ring-gray-700 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900 dark:focus:ring-gray-300 dark:focus:ring-offset-gray-900";
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
