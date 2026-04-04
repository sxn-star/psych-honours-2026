# Appwrite Student Pages Collection

Use this collection to back the homepage student index and the automatically provisioned personal student pages.

## Collection Settings

- Collection ID: `student_pages` or your own fixed ID
- Document security: enabled
- Collection permissions:
  - Read: `any`
  - Create: `users`
  - Leave update and delete unset at the collection level

The app writes document-specific permissions when it creates or updates a student page.
If `APPWRITE_STUDENTS_TEAM_ID` is configured, page and upload read access are granted to that team.

## Attributes

Create these attributes before any documents are written:

- `slug` - string - required - unique on its own via an index
- `name` - string - required
- `userId` - string - required - unique on its own via an index
- `email` - email - required
- `source` - enum - required - values: `auto`, `manual`
- `createdAt` - datetime - required

Suggested string sizes:

- `slug`: 64
- `name`: 128
- `userId`: 36

## Indexes

Create these indexes for fast lookup and to prevent duplicate pages:

- Unique index on `slug`
- Unique index on `userId`
- Key index on `email` if you want to look up pages by address later

## Document Permissions

Each student page document should be created with these permissions:

- Read: `team:{studentsTeamId}` if configured, otherwise `any`
- Update: `user:{userId}`
- Delete: `user:{userId}`

That matches the current branch behavior: all student-team members can read, and only the owning student can modify their own record.

Upload files and upload metadata documents follow the same permission pattern.

## Environment Variables

Set `APPWRITE_STUDENT_PAGES_COLLECTION_ID` to the collection ID you create here.
Set `APPWRITE_STUDENTS_TEAM_ID` if you want read access scoped to the students team.
Set `STUDENTS_TEAM_ID` and optionally `STUDENT_TEAM_ROLES` in the Appwrite Function so student-domain users are assigned automatically.

Do not put policy values like allowed email domain or admin emails in `runtime-config.js`; those belong only in the function environment.

If you leave it unset, the app falls back to the static student list in `students.js`, which is useful for local development before the Appwrite collection exists.