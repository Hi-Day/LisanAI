const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Use a dedicated temp database for E2E tests so we don't touch real data.
const E2E_DB = path.join(os.tmpdir(), `oralai-e2e-${Date.now()}.db`);
process.env.TURSO_DATABASE_URL = `file:${E2E_DB}`;
process.env.ENABLE_DEMO_SIMULATION = "false";
process.env.PORT = "4174";

const { loadEnv } = require("../server/config");
loadEnv();

const { initDatabase } = require("../server/database");
const { sendJson } = require("../server/http-utils");
const { serveStaticFile } = require("../server/static");
const { registerTenantUser, createTenantUser } = require("../server/auth-service");
const { createClass, requestJoinClass, approveMembership } = require("../server/database");

let isDbInitialized = false;

const requestHandler = async (req, res) => {
  try {
    if (!isDbInitialized) {
      await initDatabase();
      isDbInitialized = true;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      const endpointName = url.pathname.replace("/api/", "");
      try {
        const handler = require(`../api/${endpointName}`);
        return await handler(req, res);
      } catch (err) {
        return sendJson(res, 404, { error: "API endpoint not found" });
      }
    }

    if (req.method !== "GET") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    return serveStaticFile(res, path.join(__dirname, ".."), url.pathname);
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};

async function seedDemoData() {
  const { tenant, user: admin } = await registerTenantUser({
    tenantName: "E2E School",
    name: "Admin E2E",
    email: "e2e.admin@example.com",
    password: "password123",
  });
  const teacher = await createTenantUser(tenant.id, {
    name: "Guru E2E",
    email: "e2e.guru@example.com",
    password: "password123",
    role: "teacher",
  });
  const student = await createTenantUser(tenant.id, {
    name: "Siswa E2E",
    email: "e2e.siswa@example.com",
    password: "password123",
    role: "student",
  });

  const classroom = {
    id: "e2e-class-1",
    name: "Kelas E2E",
    joinCode: "E2ECLASS1",
    createdAt: new Date().toISOString(),
  };
  await createClass(tenant.id, teacher.id, classroom);

  await requestJoinClass(tenant.id, student.id, classroom.joinCode, {
    id: "e2e-member-1",
    requestedAt: new Date().toISOString(),
  });
  await approveMembership(tenant.id, teacher.id, "e2e-member-1");

  console.log("E2E demo data seeded.");
}

const server = http.createServer(requestHandler);
initDatabase()
  .then(async () => {
    await seedDemoData();
    server.listen(4174, "127.0.0.1", () => {
      console.log("E2E server running at http://127.0.0.1:4174");
    });
  })
  .catch((error) => {
    console.error("E2E server failed:", error);
    process.exit(1);
  });
