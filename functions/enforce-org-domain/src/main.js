const sdk = require("node-appwrite");

module.exports = async ({ req, res, log, error }) => {
  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const userId = payload.$id || payload.userId;
    const email = String(payload.email || "").toLowerCase();
    const allowedDomain = String(process.env.ALLOWED_DOMAIN || "").toLowerCase();

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

    const client = new sdk.Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const users = new sdk.Users(client);

    const user = await users.get(userId);
    const existingLabels = Array.isArray(user.labels) ? user.labels : [];

    const labelsWithoutDomainPrefix = existingLabels.filter((label) => label !== "orgallowed" && label !== "orgblocked" && !label.startsWith("domain:"));
    const newLabel = isAllowed ? "orgallowed" : "orgblocked";
    const updatedLabels = [...new Set([...labelsWithoutDomainPrefix, newLabel])];

    await users.updateLabels(userId, updatedLabels);

    if (!isAllowed) {
      log(`User ${userId} labeled as orgblocked (${email})`);
    }

    return res.json(
      {
        ok: true,
        userId,
        email,
        domain,
        isAllowed,
        labelAssigned: newLabel,
        deleted: false
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
