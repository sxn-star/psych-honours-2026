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

export function findStudentByUserId(userId) {
	if (!userId) return null;
	return students.find((student) => student.userId === userId) || null;
}
