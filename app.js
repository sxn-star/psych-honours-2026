// Import Appwrite SDK tools from a CDN as ES modules.
// - Client: connection to your Appwrite project
// - Account: login/logout/current user actions
// - Storage: upload and fetch files (like images)
// - Databases: create/read/update/delete database documents
// - ID: helper to generate unique IDs (e.g., ID.unique())
// - Query: helper to filter document lists
// - Permission/Role: docs-recommended helpers for access control syntax
import { Client, Account, Storage, Databases, ID, Query, Permission, Role } 
from "https://cdn.jsdelivr.net/npm/appwrite@13.0.0/+esm";

// Read runtime config from config.local.js (loaded by index.html).
// This keeps your real IDs out of source control when config.local.js is ignored.
const appConfig = window.APP_CONFIG;

if (!appConfig) {
  throw new Error(
    "Missing APP_CONFIG. Create config.local.js from config.example.js before running the app."
  );
}

const {
  endpoint = "https://cloud.appwrite.io/v1",
  projectId,
  bucketId,
  databaseId,
  collectionId
} = appConfig;

if (!projectId || !bucketId || !databaseId || !collectionId) {
  throw new Error(
    "APP_CONFIG is incomplete. Set projectId, bucketId, databaseId, and collectionId in config.local.js"
  );
}

// Create the main Appwrite client and point it to your Appwrite backend.
const client = new Client()
  // Appwrite endpoint and project are now loaded from local config.
  .setEndpoint(endpoint)
  .setProject(projectId);

// Create service objects that reuse the same configured client.
// You call methods on these later (for auth, uploads, database reads/writes).
const account = new Account(client);
const storage = new Storage(client);
const databases = new Databases(client);

// IDs loaded from local config (config.local.js).
const BUCKET_ID = bucketId;
const DB_ID = databaseId;
const COLLECTION_ID = collectionId;

// Grab the Login button from the HTML by its id="loginBtn".
// If this returns null, it usually means the element id is different or not loaded yet.
const loginBtn = document.getElementById("loginBtn");

// Update auth button behavior based on whether user is logged in.
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
    // Appwrite Web SDK v13-compatible OAuth call.
    // Use Google and return to this page on success/failure.
    account.createOAuth2Session(
      "google",
      window.location.href,
      window.location.href
    );
  };
}

// Will store the logged-in user's profile data after we fetch it.
// Starts as null (meaning: no user info loaded yet).
let currentUser = null;

// Check whether a user session already exists (for example after page refresh).
// async means this function can wait for server responses using await.
async function checkAuth() {
  // try/catch handles success vs failure of the account.get() request.
  try {
    // Ask Appwrite for the currently logged-in user's account details.
    // If no session exists, this line throws an error and goes to catch.
    currentUser = await account.get();

    // User is logged in: reveal upload controls.
    document.getElementById("uploadSection").classList.remove("hidden");

  // If account.get() fails (no session, expired session, etc.), run this block.
  } catch {
    // Keep upload section hidden and log a simple debug message.
    currentUser = null;
    console.log("Not logged in");
  }

  // Ensure button always matches current auth state.
  setAuthButton();
}
// Run auth check once when this script loads.
checkAuth();

// Get the Upload button from the page.
const uploadBtn = document.getElementById("uploadBtn");

// Convert browser file info to the exact enum values expected by collection schema.
// Current allowed values in Appwrite schema: png, jpg, pdf.
function getSchemaImageType(file) {
  const mime = String(file.type || "").toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "application/pdf") return "pdf";

  // Fallback to file extension when MIME is missing or unusual.
  const name = String(file.name || "").toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".pdf")) return "pdf";

  return null;
}

// Run this function when user clicks Upload.
// async is needed because file upload/database calls take time.
uploadBtn.onclick = async () => {
  // Safety check: uploads require an authenticated user.
  if (!currentUser) return alert("Please log in first");

  // Read the first selected file from the file input.
  // .files is a list, so [0] means "the first chosen file".
  const file = document.getElementById("fileInput").files[0];

  // Guard clause: stop immediately if user did not pick a file.
  if (!file) return alert("Select a file");

  // Match Appwrite enum requirement before uploading.
  const schemaImageType = getSchemaImageType(file);
  if (!schemaImageType) {
    return alert("Unsupported file type. Allowed: png, jpg, pdf.");
  }

  // Keep reference in case we need cleanup if step 2 fails.
  let uploadedFileId = null;

  // try/catch keeps the UI responsive if upload or database write fails.
  try {
    // Build permissions using Appwrite's helper syntax (docs style).
    // This means:
    // - anyone can read
    // - only the current user can update/delete
    const ownerPermissions = [
      Permission.read(Role.any()),
      Permission.update(Role.user(currentUser.$id)),
      Permission.delete(Role.user(currentUser.$id))
    ];

    // Step 1: Upload the actual file to Appwrite Storage.
    // Appwrite Web SDK v13 uses positional arguments here.
    const uploaded = await storage.createFile(
      // Which storage bucket to upload into.
      BUCKET_ID,
      // Auto-generate a unique file ID.
      ID.unique(),
      // The browser File object selected by the user.
      file,
      // File permissions.
      ownerPermissions
    );
    uploadedFileId = uploaded.$id;

    // Step 2: Save metadata in the database (separate from the file itself).
    // This lets you query/filter records without reading raw storage directly.
    await databases.createDocument(
      // Database + collection where gallery records are stored.
      DB_ID,
      COLLECTION_ID,
      // Auto-generate a unique document ID.
      ID.unique(),
      // Document data (fields must match your collection attributes).
      {
        // Link document to the uploaded storage file.
        // Collection schema expects this field as imageId.
        imageId: uploaded.$id,
        // Human-readable image name (required by current collection schema).
        imageName: file.name,
        // Enum value required by current schema (png, jpg, pdf).
        imageType: schemaImageType,
        // File size in bytes (required by current schema).
        imageSize: file.size,
        // Datetime in ISO format for schema field uploadDate.
        uploadDate: new Date().toISOString(),
        // Track uploader for schema field uploadedBy.
        uploadedBy: currentUser.email || currentUser.$id,
        // Example moderation flag.
        approved: true
      },
      // Document permissions (same pattern as file permissions).
      ownerPermissions
    );

    // Refresh the gallery so the newly uploaded image appears on screen.
    loadImages();
  } catch (error) {
    // Log technical details for debugging.
    console.error("Upload failed:", error);

    // If the file was uploaded but metadata failed, try to clean up orphan file.
    if (uploadedFileId) {
      try {
        await storage.deleteFile(BUCKET_ID, uploadedFileId);
      } catch (cleanupError) {
        console.error("Cleanup failed (orphan file may remain):", cleanupError);
      }
    }

    // Show the actual Appwrite message to make debugging easier.
    const detail = error && error.message ? error.message : "Unknown error";
    alert(`Upload failed: ${detail}`);
  }
};

// Load approved images from the database and render them into the gallery.
async function loadImages() {
  // Get gallery element first so we can update UI in both success and error cases.
  const gallery = document.getElementById("gallery");
  if (!gallery) return;

  // try/catch prevents one failed request from crashing the whole page.
  try {
    const res = await databases.listDocuments(
      DB_ID,
      COLLECTION_ID,
      [Query.equal("approved", true)]
    );

    // Clear old images before rendering the fresh list.
    gallery.innerHTML = "";

    // Build dedicated student-page links from uploadedBy field.
    renderStudentLinks(res.documents);

    res.documents.forEach((doc) => {
      const img = document.createElement("img");

      // Prefer schema field imageId; fallback to fileId for older records.
      const imageId = doc.imageId || doc.fileId;
      if (!imageId) {
        return;
      }

      // Use SDK helper to build the correct file view URL.
      img.src = storage.getFileView(BUCKET_ID, imageId);
      img.className = "rounded-xl shadow";

      // If a single image fails to load, hide just that image instead of breaking all.
      img.onerror = () => {
        img.remove();
      };

      gallery.appendChild(img);
    });
  } catch (error) {
    // Log technical details for debugging.
    console.error("Failed to load gallery images:", error);

    // Show error detail to help identify permissions/schema issues.
    const detail = error && error.message ? error.message : "Unknown error";
    gallery.innerHTML = `<p class="text-sm text-gray-500">Could not load images: ${detail}</p>`;
  }
}

// Render one link per student to dedicated student gallery pages.
function renderStudentLinks(documents) {
  const studentLinks = document.getElementById("studentLinks");
  if (!studentLinks) return;

  studentLinks.innerHTML = "";

  const students = [...new Set(documents.map((doc) => doc.uploadedBy).filter(Boolean))].sort();
  if (students.length === 0) {
    studentLinks.innerHTML = "<p class=\"text-sm text-gray-500\">No student pages yet.</p>";
    return;
  }

  students.forEach((student) => {
    const link = document.createElement("a");
    link.href = `student.html?student=${encodeURIComponent(student)}`;
    link.textContent = student;
    link.className = "inline-block bg-white border px-3 py-2 rounded-xl mr-2 mb-2 hover:bg-gray-100";
    studentLinks.appendChild(link);
  });
}

loadImages();