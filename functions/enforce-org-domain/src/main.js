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

    const userId = payload.$id || payload.userId;
    const email = String(payload.email || "").toLowerCase();
    const allowedDomain = String(process.env.ALLOWED_DOMAIN || "").toLowerCase();
    const adminEmails = parseCsv(process.env.ADMIN_EMAILS).map((value) => value.toLowerCase());
    const studentsTeamId = String(process.env.STUDENTS_TEAM_ID || "").trim();
    const studentTeamRoles = parseCsv(process.env.STUDENT_TEAM_ROLES);

    if (!userId || !email || !allowedDomain) {
      return res.json(
        {
          ok: false,
          reason: "Missing userId/email/ALLOWED_DOMAIN"
        },
        200
      );
    }

    const domain = email.split("@")[1] || "";
    const isAllowed = domain === allowedDomain;
    const isAdmin = adminEmails.includes(email);
    const roleLabel = isAdmin ? "role:admin" : isAllowed ? "role:student" : null;

    const client = new sdk.Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const users = new sdk.Users(client);
  const teams = new sdk.Teams(client);

    const user = await users.get(userId);
    const existingLabels = Array.isArray(user.labels) ? user.labels : [];

    const labelsWithoutDomainPrefix = existingLabels.filter((label) => !label.startsWith("domain:") && !label.startsWith("role:"));
    const newLabels = [isAllowed ? `domain:${allowedDomain}` : "domain:blocked"];

    if (roleLabel) {
      newLabels.push(roleLabel);
    }

    const updatedLabels = [...new Set([...labelsWithoutDomainPrefix, ...newLabels])];

    await users.updateLabels(userId, updatedLabels);

    let teamMembershipAction = "not-configured";
    let membershipId = null;

    if (studentsTeamId) {
      const memberships = await teams.listMemberships(studentsTeamId, [sdk.Query.equal("userId", userId), sdk.Query.limit(1)]);
      const existingMembership = memberships.memberships?.[0] || null;
      membershipId = existingMembership?.$id || null;

      if (isAllowed && !isAdmin) {
        if (!existingMembership) {
          const membership = await teams.createMembership(
            studentsTeamId,
            studentTeamRoles.length > 0 ? studentTeamRoles : ["student"],
            undefined,
            userId
          );
          membershipId = membership?.$id || null;
          teamMembershipAction = "added";
          log(`User ${userId} auto-added to students team ${studentsTeamId}`);
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
