// Student directory used by homepage search/index and student-specific pages.
// Replace placeholder userId values with the real Appwrite account IDs for each student.
export const students = [
  {
    slug: "student-1",
    name: "Student One",
    userId: "REPLACE_WITH_USER_ID_1"
  },
  {
    slug: "student-2",
    name: "Student Two",
    userId: "REPLACE_WITH_USER_ID_2"
  },
  {
    slug: "student-3",
    name: "Student Three",
    userId: "REPLACE_WITH_USER_ID_3"
  }
];

export function findStudentBySlug(slug) {
  if (!slug) return null;
  return students.find((student) => student.slug === slug) || null;
}

function getAppConfig() {
  return window.APP_CONFIG || {};
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getEmailDomain(email) {
  const normalizedEmail = normalizeEmail(email);
  const atIndex = normalizedEmail.lastIndexOf("@");

  if (atIndex === -1) return "";

  return normalizedEmail.slice(atIndex + 1);
}

function getUserLabels(user) {
  return new Set(Array.isArray(user?.labels) ? user.labels : []);
}

export function isAdminAccount(user) {
  const email = normalizeEmail(user?.email);
  if (!email) return false;

  const labels = getUserLabels(user);
  if (labels.has("role:admin")) return true;

  return false;
}

export function isGoogleOAuthSession(session) {
  return String(session?.provider || "").toLowerCase() === "google";
}

export function canAutoCreateStudentPage(user, session) {
  const labels = getUserLabels(user);
  return isGoogleOAuthSession(session) && labels.has("role:student") && !isAdminAccount(user);
}

function toSlugSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function deriveStudentSlug(user) {
  const normalizedEmail = normalizeEmail(user?.email);
  const emailPrefix = normalizedEmail.split("@")[0] || "";
  const slugBase = toSlugSegment(emailPrefix) || toSlugSegment(user?.name) || toSlugSegment(user?.$id) || "student";

  return slugBase.startsWith("student-") ? slugBase : `student-${slugBase}`;
}

export function deriveStudentDisplayName(user) {
  const name = String(user?.name || "").trim();
  if (name) return name;

  const emailPrefix = normalizeEmail(user?.email).split("@")[0] || "student";
  return emailPrefix
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Student";
}

export function buildAutoStudentPage(user) {
  const email = normalizeEmail(user?.email);

  return {
    slug: deriveStudentSlug(user),
    name: deriveStudentDisplayName(user),
    userId: user?.$id || "",
    email,
    source: "auto",
    createdAt: new Date().toISOString()
  };
}

function getConfiguredStudentPagesCollectionId() {
  return String(getAppConfig().studentPagesCollectionId || "").trim();
}

export function getStudentPagesCollectionId() {
  return getConfiguredStudentPagesCollectionId();
}

export function hasStudentPagesCollection() {
  return Boolean(getConfiguredStudentPagesCollectionId());
}

export function normalizeStudentPageDocument(document) {
  if (!document) return null;

  const slug = String(document.slug || "").trim();
  const name = String(document.name || "").trim();
  const userId = String(document.userId || "").trim();

  if (!slug || !name || !userId) return null;

  return {
    slug,
    name,
    userId,
    email: normalizeEmail(document.email || ""),
    source: String(document.source || "appwrite").trim() || "appwrite",
    createdAt: String(document.createdAt || document.$createdAt || "")
  };
}

export function getStudentPageByUser(user) {
  if (!user) return null;
  return buildAutoStudentPage(user);
}

export function getStudentDisplayName(student) {
  return student?.name || "Student";
}
