import { ID, Permission, Query, Role } from "https://cdn.jsdelivr.net/npm/appwrite@13.0.0/+esm";
import { students, findStudentBySlug, findStudentByUserId } from "./students.js";

function normalizeText(value) {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function stripDiacritics(value) {
	return normalizeText(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function mapStudentPageDocument(document) {
	return {
		$id: document.$id,
		slug: normalizeText(document.slug),
		name: normalizeText(document.name),
		userId: normalizeText(document.userId),
		email: normalizeText(document.email).toLowerCase(),
		source: normalizeText(document.source) || "manual",
		createdAt: document.createdAt || ""
	};
}

function buildStudentPagePermissions(userId) {
	return [
		Permission.read(Role.any()),
		Permission.update(Role.user(userId)),
		Permission.delete(Role.user(userId))
	];
}

async function listDocuments(databases, databaseId, collectionId, queries) {
	try {
		const response = await databases.listDocuments(databaseId, collectionId, queries);
		return Array.isArray(response.documents) ? response.documents : [];
	} catch {
		return [];
	}
}

function isUsablePage(page) {
	return Boolean(page && page.slug && page.name);
}

export function normalizeStudentName(fullName) {
	return normalizeText(fullName);
}

export function slugifyStudentName(fullName) {
	const normalized = stripDiacritics(fullName).toLowerCase();
	const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
	return slug || "student";
}

export function getStudentPagesCollectionId(appConfig) {
	return normalizeText(appConfig?.studentPagesCollectionId || "");
}

export function getAllowedEmailDomain(appConfig) {
	return normalizeText(appConfig?.allowedDomain || "")
		.toLowerCase()
		.replace(/^@+/, "");
}

const ALLOWED_DOMAIN_LABEL = "orgallowed";
const BLOCKED_DOMAIN_LABEL = "orgblocked";

export function isAllowedEmailForDomain(email, appConfig) {
	const normalizedEmail = normalizeText(email).toLowerCase();
	if (!normalizedEmail) {
		return true;
	}

	const allowedDomain = getAllowedEmailDomain(appConfig);
	if (!allowedDomain) {
		return true;
	}

	const domain = normalizedEmail.split("@")[1] || "";
	return domain === allowedDomain;
}

export function getUserDomainLabel(user, appConfig) {
	const labels = Array.isArray(user?.labels) ? user.labels : [];

	if (labels.includes(ALLOWED_DOMAIN_LABEL)) {
		return ALLOWED_DOMAIN_LABEL;
	}

	if (labels.includes(BLOCKED_DOMAIN_LABEL)) {
		return BLOCKED_DOMAIN_LABEL;
	}

	return "";
}

export function getUserDomainStatus(user, appConfig) {
	const domainLabel = getUserDomainLabel(user, appConfig);
	if (domainLabel === BLOCKED_DOMAIN_LABEL) {
		return "blocked";
	}

	if (domainLabel) {
		return "allowed";
	}

	return "pending";
}

export async function listStudentPages({ databases, databaseId, appConfig }) {
	const collectionId = getStudentPagesCollectionId(appConfig);
	if (!collectionId) {
		return students.map((student) => ({ ...student }));
	}

	const documents = await listDocuments(databases, databaseId, collectionId, [Query.orderAsc("name")]);
	return documents.map(mapStudentPageDocument).filter(isUsablePage);
}

export async function findStudentPageBySlug({ databases, databaseId, appConfig, slug }) {
	const normalizedSlug = normalizeText(slug);
	if (!normalizedSlug) {
		return null;
	}

	const collectionId = getStudentPagesCollectionId(appConfig);
	if (collectionId) {
		const documents = await listDocuments(databases, databaseId, collectionId, [Query.equal("slug", normalizedSlug), Query.limit(1)]);
		const page = documents[0];
		if (page) {
			return mapStudentPageDocument(page);
		}
	}

	return findStudentBySlug(normalizedSlug);
}

export async function findStudentPageByUserId({ databases, databaseId, appConfig, userId }) {
	const normalizedUserId = normalizeText(userId);
	if (!normalizedUserId) {
		return null;
	}

	const collectionId = getStudentPagesCollectionId(appConfig);
	if (collectionId) {
		const documents = await listDocuments(databases, databaseId, collectionId, [Query.equal("userId", normalizedUserId), Query.limit(1)]);
		const page = documents[0];
		if (page) {
			return mapStudentPageDocument(page);
		}
	}

	return findStudentByUserId(normalizedUserId);
}

async function updateStudentPagePrefs(account, studentPage) {
	if (!studentPage?.slug) {
		return;
	}

	try {
		await account.updatePrefs({
			studentSlug: studentPage.slug,
			studentName: studentPage.name
		});
	} catch {
	}
}

async function getStudentPageCandidates(databases, databaseId, collectionId, baseSlug, userId) {
	const candidates = [];
	let suffix = 0;

	while (candidates.length < 20) {
		const slug = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
		const existing = await listDocuments(databases, databaseId, collectionId, [Query.equal("slug", slug), Query.limit(1)]);
		const page = existing[0] ? mapStudentPageDocument(existing[0]) : null;
		if (!page || page.userId === userId) {
			candidates.push({ slug, page });
		}
		suffix += 1;
		if (!page) {
			break;
		}
	}

	return candidates;
}

export async function resolveCurrentStudentPage({ account, databases, databaseId, appConfig }) {
	const collectionId = getStudentPagesCollectionId(appConfig);
	let currentUser = null;

	try {
		currentUser = await account.get();
	} catch {
		return null;
	}

	if (!isAllowedEmailForDomain(currentUser.email, appConfig)) {
		return null;
	}

	if (!collectionId) {
		return findStudentByUserId(currentUser.$id);
	}

	let prefs = {};
	try {
		prefs = await account.getPrefs();
	} catch {
		prefs = {};
	}

	if (prefs.studentSlug) {
		const pageBySlug = await findStudentPageBySlug({
			databases,
			databaseId,
			appConfig,
			slug: prefs.studentSlug
		});

		if (pageBySlug && (!pageBySlug.userId || pageBySlug.userId === currentUser.$id)) {
			if (!pageBySlug.userId) {
				await updateStudentPagePrefs(account, pageBySlug);
			}
			return pageBySlug;
		}
	}

	const pageByUserId = await findStudentPageByUserId({
		databases,
		databaseId,
		appConfig,
		userId: currentUser.$id
	});

	if (pageByUserId) {
		await updateStudentPagePrefs(account, pageByUserId);
	}

	return pageByUserId;
}

export async function claimStudentPageForUser({ account, databases, databaseId, appConfig, fullName }) {
	const collectionId = getStudentPagesCollectionId(appConfig);
	if (!collectionId) {
		throw new Error("Student pages are not configured yet.");
	}

	const name = normalizeStudentName(fullName);
	if (!name) {
		throw new Error("Enter your full name to create your page.");
	}

	const currentUser = await account.get();
	if (!isAllowedEmailForDomain(currentUser.email, appConfig)) {
		throw new Error("Use your allowed email domain to create a student page.");
	}

	const email = normalizeText(currentUser.email || "").toLowerCase();

	const existingByUser = await findStudentPageByUserId({
		databases,
		databaseId,
		appConfig,
		userId: currentUser.$id
	});

	if (existingByUser) {
		const updated = await databases.updateDocument(
			databaseId,
			collectionId,
			existingByUser.$id,
			{
				name,
				email: email || existingByUser.email || "",
				userId: currentUser.$id,
				slug: existingByUser.slug,
				source: existingByUser.source || "manual",
				createdAt: existingByUser.createdAt || new Date().toISOString()
			},
			buildStudentPagePermissions(currentUser.$id)
		);

		const studentPage = mapStudentPageDocument(updated);
		await updateStudentPagePrefs(account, studentPage);
		return studentPage;
	}

	const baseSlug = slugifyStudentName(name);
	const candidates = await getStudentPageCandidates(databases, databaseId, collectionId, baseSlug, currentUser.$id);
	const selectedCandidate = candidates[0] || { slug: baseSlug, page: null };
	const slug = selectedCandidate.slug;
	const existingPage = selectedCandidate.page;
	const payload = {
		slug,
		name,
		userId: currentUser.$id,
		email,
		source: existingPage?.source || "manual",
		createdAt: existingPage?.createdAt || new Date().toISOString()
	};

	let studentPage;
	if (existingPage && (!existingPage.userId || existingPage.userId === currentUser.$id)) {
		const updated = await databases.updateDocument(
			databaseId,
			collectionId,
			existingPage.$id,
			payload,
			buildStudentPagePermissions(currentUser.$id)
		);
		studentPage = mapStudentPageDocument(updated);
	} else {
		const created = await databases.createDocument(
			databaseId,
			collectionId,
			ID.unique(),
			payload,
			buildStudentPagePermissions(currentUser.$id)
		);
		studentPage = mapStudentPageDocument(created);
	}

	await updateStudentPagePrefs(account, studentPage);
	return studentPage;
}