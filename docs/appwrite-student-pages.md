# Appwrite Student Pages Collection

This collection backs the homepage student index, the first-login name prompt, and the automatically provisioned personal student pages.

When a student logs in (via Google OAuth) for the first time, the app prompts them once for their full name, then creates or claims a student page record and saves the page slug in their Appwrite account prefs. On all later logins, the app reads the slug from prefs and redirects them to their page without asking for the name again.

## Setup Checklist

### 1. Create the Collection

In the Appwrite console:
- **Collection ID:** Use `student_pages` (or any fixed ID you prefer)
- **Document Security:** Enable document-level security
- **Collection Permissions:**
  - Read: `any` *(so the homepage can list all pages)*
  - Create: `users` *(so logged-in users can create pages)*
  - Update: (leave unset; documents inherit)
  - Delete: (leave unset; documents inherit)

### 2. Create Attributes

Add these attributes **before** writing any documents. All are required:

| Attribute | Type | Size | Notes |
|-----------|------|------|-------|
| `slug` | String | 64 | Unique page slug, generated from student name. Indexed uniquely. |
| `name` | String | 128 | Full name of the student. Used in the index and page title. |
| `userId` | String | 36 | Appwrite user ID. Indexed uniquely. |
| `email` | Email | – | Student email address (captured from OAuth). Indexed (non-unique) for lookup. |
| `source` | Enum | – | Values: `auto` or `manual`. Indicates how the page was created. |
| `createdAt` | DateTime | – | Timestamp when the page was first created (preserved across updates). |

### 3. Create Indexes

Create exactly three indexes. These ensure slug and userId uniqueness and allow fast email lookup:

| Index Name | Attribute | Type | Unique |
|------------|-----------|------|--------|
| slug_index | slug | Unique | Yes |
| userId_index | userId | Unique | Yes |
| email_index | email | Key | No |

### 4. Set Document Permissions

When documents are created or updated by the app, they are granted these permissions:

- **Read:** `any` *(all visitors can see the page in the index)*
- **Update:** `user:{userId}` *(only the page owner can edit)*
- **Delete:** `user:{userId}` *(only the page owner can delete)*

The app applies these permissions programmatically; you do not set them at the collection level.

### 5. Configure App Environment

Set these environment variables where you deploy the app:

```bash
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_DATABASE_ID=your_database_id
APPWRITE_STUDENT_PAGES_COLLECTION_ID=student_pages
# Optional: configure bucket and upload collection for gallery uploads
APPWRITE_BUCKET_ID=your_bucket_id
APPWRITE_COLLECTION_ID=your_uploads_collection_id
```

## How First-Login Onboarding Works

1. **User logs in:** OAuth redirect → `index.html` → `app.js` calls `checkAuth()`
2. **App checks for existing page:** `resolveCurrentStudentPage()` queries for a page by the user's ID and checks account prefs
3. **No page found:**
   - If `studentPagesCollectionId` is configured: show the name prompt → wait for input
   - If not configured: redirect to static student list fallback (for local dev)
4. **User enters name:** Form calls `claimStudentPageForUser(fullName)`
   - App slugifies the name (e.g., "Alex Morgan" → "alex-morgan")
   - App creates a new document or updates an existing unclaimed one
   - App saves `studentSlug` and `studentName` in account prefs
5. **Page created:** Redirect to `student.html?student=alex-morgan`
6. **Future logins:** App finds the page via prefs → redirect instantly without prompting

## Account Preferences

The app stores these values in the logged-in user's Appwrite account prefs:

```javascript
{
  studentSlug: "alex-morgan",
  studentName: "Alex Morgan"
}
```

These prefs are updated whenever a page is resolved or created, and are used to speed up redirect on future logins.

## Related Collections and Uploads

Upload files and upload metadata documents follow the same permission pattern as student pages:

- **Files:** Stored in a Storage bucket with `Read: any`, `Update: user:{userId}`, `Delete: user:{userId}`
- **Metadata:** Stored in a separate collection (typically `uploads`) with the same permissions

See the main README for upload collection schema details.

## Fallback Mode

If `APPWRITE_STUDENT_PAGES_COLLECTION_ID` is not set (e.g., during local development):
- Onboarding is skipped
- The app falls back to the static `students.js` roster
- Users with matching `userId` in the roster can still upload to their page
- No new pages can be provisioned

## Troubleshooting

**Problem:** "Enter your full name" prompt does not appear after login.  
**Solution:** Check that `APPWRITE_STUDENT_PAGES_COLLECTION_ID` is set in your environment and matches the collection you created.

**Problem:** Slug generation fails or creates weird characters.  
**Solution:** The app slugifies names by normalizing whitespace, stripping diacritics, and converting to lowercase. Names like "José María" become "jose-maria". If a slug already exists, the app adds a suffix (e.g., "jose-maria-2").

**Problem:** User is redirected to someone else's page after login.  
**Solution:** Check the unique indexes on `userId` and `slug`. Duplicates will corrupt the routing. Fix by deleting the duplicate documents and re-creating the indexes.