import { Client, Account, Storage, Databases, Query } from "https://cdn.jsdelivr.net/npm/appwrite@13.0.0/+esm";

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
let currentUser = null;

function setAuthButton() {
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

function getStudentFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("student");
}

async function loadStudentGallery() {
  const student = getStudentFromUrl();
  const title = document.getElementById("studentTitle");
  const gallery = document.getElementById("studentGallery");

  if (!student) {
    title.textContent = "Student not specified";
    gallery.innerHTML = "<p class=\"text-sm text-gray-500\">Use a student link from the home page.</p>";
    return;
  }

  title.textContent = `Gallery: ${student}`;

  try {
    const res = await databases.listDocuments(
      databaseId,
      collectionId,
      [
        Query.equal("approved", true),
        Query.equal("uploadedBy", student)
      ]
    );

    gallery.innerHTML = "";

    if (res.documents.length === 0) {
      gallery.innerHTML = "<p class=\"text-sm text-gray-500\">No approved uploads for this student yet.</p>";
      return;
    }

    res.documents.forEach((doc) => {
      const imageId = doc.imageId || doc.fileId;
      if (!imageId) return;

      const img = document.createElement("img");
      img.src = storage.getFileView(bucketId, imageId);
      img.className = "rounded-xl shadow";
      img.onerror = () => img.remove();
      gallery.appendChild(img);
    });
  } catch (error) {
    const detail = error && error.message ? error.message : "Unknown error";
    gallery.innerHTML = `<p class=\"text-sm text-gray-500\">Could not load student gallery: ${detail}</p>`;
  }
}

await checkAuth();
await loadStudentGallery();
