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
const searchInput = document.getElementById("studentSearch");
const studentLinks = document.getElementById("studentLinks");

let currentUser = null;

function setAuthButton() {
  if (!loginBtn) return;

  if (currentUser) {
    loginBtn.textContent = "Log out";
    loginBtn.onclick = async () => {
      await account.deleteSession("current");
      window.location.reload();
    };
    return;
  }

  loginBtn.textContent = "Login";
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
    studentLinks.innerHTML = "<p class=\"text-sm text-gray-500\">No matching student pages found.</p>";
    return;
  }

  filtered.forEach((student) => {
    const link = document.createElement("a");
    link.href = `student.html?student=${encodeURIComponent(student.slug)}`;
    link.textContent = student.name;
    link.className = "block bg-white border rounded-xl px-4 py-3 mb-2 hover:bg-gray-100";
    studentLinks.appendChild(link);
  });
}

if (searchInput) {
  searchInput.addEventListener("input", (event) => {
    renderStudentIndex(event.target.value);
  });
}

await checkAuth();
renderStudentIndex();
