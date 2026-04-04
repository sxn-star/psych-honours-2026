const sdk = require("node-appwrite");

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = async ({ req, res, log, error }) => {
  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const headers = req.headers || {};

    const allowedDomain = String(process.env.ALLOWED_DOMAIN || "").toLowerCase();
    const adminEmails = parseCsv(process.env.ADMIN_EMAILS).map((value) => value.toLowerCase());
    const studentsTeamId = String(process.env.STUDENTS_TEAM_ID || "").trim();
    const studentTeamRoles = parseCsv(process.env.STUDENT_TEAM_ROLES);

    const endpoint = String(process.env.APPWRITE_ENDPOINT || process.env.APPWRITE_FUNCTION_API_ENDPOINT || "").trim();
    const projectId = String(process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID || "").trim();
    const apiKey = String(process.env.APPWRITE_API_KEY || "").trim();

    if (!allowedDomain) {
      throw new Error("Missing ALLOWED_DOMAIN");
    }

    if (!endpoint || !projectId || !apiKey) {
      throw new Error("Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY");
    }

    const client = new sdk.Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);

    const users = new sdk.Users(client);
    const teams = new sdk.Teams(client);

    const userId = String(payload.$id || payload.userId || headers["x-appwrite-user-id"] || process.env.APPWRITE_FUNCTION_USER_ID || "").trim();
    if (!userId) {
      throw new Error("Missing userId in event payload or Appwrite runtime headers");
    }

    const user = await users.get(userId);
    const email = String(payload.email || payload.userEmail || user.email || headers["x-appwrite-user-email"] || "").toLowerCase();

    if (!email) {
      throw new Error(`Missing email for user ${userId}`);
    }

    const domain = email.split("@")[1] || "";
    const isAllowed = domain === allowedDomain;
    const isAdmin = adminEmails.includes(email);
    const roleLabel = isAdmin ? "role:admin" : isAllowed ? "role:student" : null;

    const existingLabels = Array.isArray(user.labels) ? user.labels : [];
    const labelsWithoutPolicy = existingLabels.filter((label) => !label.startsWith("domain:") && !label.startsWith("role:"));
    const nextLabels = [...labelsWithoutPolicy, isAllowed ? `domain:${allowedDomain}` : "domain:blocked"];

    if (roleLabel) {
      nextLabels.push(roleLabel);
    }

    const updatedLabels = [...new Set(nextLabels)];
    await users.updateLabels(userId, updatedLabels);

    let teamMembershipAction = "not-configured";
    let membershipId = null;

    if (studentsTeamId) {
      const memberships = await teams.listMemberships(studentsTeamId, [sdk.Query.equal("userId", [userId]), sdk.Query.limit(1)]);
      const existingMembership = memberships.memberships?.[0] || null;
      membershipId = existingMembership?.$id || null;

      if (isAllowed && !isAdmin) {
        if (!existingMembership) {
          const membership = await teams.createMembership(
            studentsTeamId,
            email,
            studentTeamRoles.length > 0 ? studentTeamRoles : ["student"],
            "",
            user.name || email
          );
          membershipId = membership?.$id || null;
          teamMembershipAction = "added";
          log(`User ${userId} auto-added to students team ${studentsTeamId}`);
        } else if (
          studentTeamRoles.length > 0 &&
          Array.isArray(existingMembership.roles) &&
          JSON.stringify(existingMembership.roles) !== JSON.stringify(studentTeamRoles)
        ) {
          const updatedMembership = await teams.updateMembershipRoles(studentsTeamId, existingMembership.$id, studentTeamRoles);
          membershipId = updatedMembership?.$id || existingMembership.$id;
          teamMembershipAction = "roles-updated";
        } else {
          teamMembershipAction = "already-member";
        }
      } else if (existingMembership) {
        await teams.deleteMembership(studentsTeamId, existingMembership.$id);
        teamMembershipAction = "removed";
        log(`User ${userId} removed from students team ${studentsTeamId}`);
      } else {
        teamMembershipAction = "not-member";
      }
    }

    if (isAdmin) {
      log(`User ${userId} labeled as role:admin (${email})`);
    } else if (!isAllowed) {
      log(`User ${userId} labeled as domain:blocked (${email})`);
    }

    return res.json(
      {
        ok: true,
        userId,
        email,
        domain,
        isAllowed,
        isAdmin,
        labelsAssigned: updatedLabels,
        studentsTeamId: studentsTeamId || null,
        teamMembershipAction,
        teamMembershipId: membershipId
      },
      200
    );
  } catch (e) {
    error(e && e.message ? e.message : String(e));
    return res.json(
      {
        ok: false,
        error: e && e.message ? e.message : String(e)
      },
      500
    );
  }
};
