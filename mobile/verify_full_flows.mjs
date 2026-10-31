import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000/api/v1";

console.log("==================================================================");
console.log("COMPREHENSIVE FRONTEND-TO-BACKEND API & WORKFLOW VERIFICATION");
console.log(`Target: ${BASE_URL}`);
console.log("==================================================================\n");

let passed = 0;
let failed = 0;

function report(condition, label, detail = "") {
  if (condition) {
    console.log(`[PASS] ${label}${detail ? ` -> ${detail}` : ""}`);
    passed++;
  } else {
    console.error(`[FAIL] ${label}${detail ? ` -> ${detail}` : ""}`);
    failed++;
  }
}

async function run() {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Mode": "true",
    },
    timeout: 15000,
  });

  // 1. Connectivity & Health Check
  try {
    const health = await client.get("/health");
    report(health.status === 200 && health.data.status === "ok", "API Connectivity & /health check", `Service: ${health.data.service}`);
  } catch (err) {
    report(false, "API Connectivity & /health check", err.message);
  }

  // 2. Registration & Email OTP Flow
  const rand = Math.floor(Math.random() * 90000 + 10000);
  const testEmail = `student.test.${rand}@gmail.com`;
  const studentId = `STU-FLOW-${rand}`;
  const password = "ValidPassword123!";
  let verificationToken = null;

  try {
    // Send OTP
    const sendRes = await client.post("/auth/send-otp", { email: testEmail });
    report(sendRes.status === 200 && sendRes.data.cooldownSeconds === 60, "POST /auth/send-otp", `Cooldown: ${sendRes.data.cooldownSeconds}s`);

    // Verify OTP (using seed verification token generation)
    const { execSync } = await import("child_process");
    verificationToken = execSync(
      `PYTHONPATH=backend venv/bin/python -c "from tests.conftest import make_verification_token; print(make_verification_token('${testEmail}'))"`,
    ).toString().trim();

    // Register User
    const regRes = await client.post("/auth/register", {
      name: "Verified Test Student",
      email: testEmail,
      studentId,
      password,
      role: "student",
      verificationToken,
    });
    report(regRes.status === 201 && !!regRes.data.accessToken, "Student Registration with verified OTP", `Issued Token: ${regRes.data.accessToken.slice(0, 15)}...`);
  } catch (err) {
    report(false, "Registration & OTP flow", err.response?.data?.error?.message || err.message);
  }

  // 3. Student Login & Session Restoration
  let studentToken = "";
  try {
    const loginRes = await client.post("/auth/login", {
      email: testEmail,
      password,
      role: "student",
    });
    studentToken = loginRes.data.accessToken;
    report(loginRes.status === 200 && loginRes.data.user.role === "student", "Student Login with newly created credentials", `Role: ${loginRes.data.user.role}`);

    const meRes = await client.get("/auth/me", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    report(meRes.status === 200 && meRes.data.email === testEmail, "Session Restoration (GET /auth/me)", `Verified Student: ${meRes.data.email}`);
  } catch (err) {
    report(false, "Student Login & Session Restoration", err.response?.data?.error?.message || err.message);
  }

  // 4. Student Dashboard Metrics & Departments
  let deptId = "";
  try {
    const deptRes = await client.get("/departments");
    report(deptRes.status === 200 && Array.isArray(deptRes.data) && deptRes.data.length > 0, "Fetch Departments list", `${deptRes.data.length} departments found`);
    deptId = deptRes.data[0]?.id || "facilities-dept";

    const compRes = await client.get(`/complaints?studentId=${studentId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    report(compRes.status === 200 && Array.isArray(compRes.data), "Student Dashboard Complaint Listing", `Initial count: ${compRes.data.length}`);
  } catch (err) {
    report(false, "Student Dashboard Metrics & Departments", err.response?.data?.error?.message || err.message);
  }

  // 5. Submit Complaint with Photo Attachment
  let createdTicket = null;
  const samplePhoto = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  try {
    const submitRes = await client.post(
      "/complaints",
      {
        title: "Air conditioning leaking water in lab 304",
        description: "Heavy condensation and water dripping over electrical plugs in computer lab 304.",
        category: "facilities",
        departmentId: deptId,
        location: "Computer Lab 304",
        imageUrl: samplePhoto,
      },
      { headers: { Authorization: `Bearer ${studentToken}` } },
    );
    createdTicket = submitRes.data;
    report(
      submitRes.status === 201 || submitRes.status === 200,
      "Submit Complaint with Photo Attachment",
      `Ticket: ${createdTicket.ticket} (ID: ${createdTicket.id})`,
    );
  } catch (err) {
    report(false, "Submit Complaint", err.response?.data?.error?.message || err.message);
  }

  // 6. AI Triage & Semantic Duplicate Detection
  try {
    const aiRes = await client.post(
      "/ai/classify",
      {
        title: "Air conditioning leaking water in lab 304",
        description: "Heavy condensation and water dripping over electrical plugs in computer lab 304.",
        location: "Computer Lab 304",
      },
      { headers: { Authorization: `Bearer ${studentToken}` } },
    );
    report(
      aiRes.status === 200 && aiRes.data.category === "facilities",
      "AI Classify Endpoint",
      `Category: ${aiRes.data.category}, Urgency: ${Math.round(aiRes.data.urgencyScore * 100)}%`,
    );

    const dupRes = await client.post(
      "/ai/detect-duplicates",
      {
        title: "Water dripping from AC in 304",
        description: "Cooling unit leaking on desk in room 304.",
        category: "facilities",
      },
      { headers: { Authorization: `Bearer ${studentToken}` } },
    );
    report(
      dupRes.status === 200 && dupRes.data.matches.length > 0,
      "AI Semantic Duplicate Detection",
      `Top Match: ${Math.round(dupRes.data.topSimilarity * 100)}% similarity`,
    );
  } catch (err) {
    report(false, "AI Triage & Semantic Duplicates", err.response?.data?.error?.message || err.message);
  }

  // 7. Complaint Tracking by Ticket ID
  try {
    const trackRes = await client.get(`/complaints/${createdTicket.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    report(
      trackRes.status === 200 && trackRes.data.ticket === createdTicket.ticket,
      "Track Complaint by Ticket ID",
      `Found status: ${trackRes.data.status}, Updates count: ${trackRes.data.updates.length}`,
    );
  } catch (err) {
    report(false, "Track Complaint by Ticket ID", err.response?.data?.error?.message || err.message);
  }

  // 8. Admin Dashboard & Operations Triage
  let adminToken = "";
  try {
    const adminLogin = await client.post("/auth/login", {
      email: "admin@campus.edu",
      password: "campus123",
      role: "admin",
    });
    adminToken = adminLogin.data.accessToken;
    report(adminLogin.status === 200 && adminLogin.data.user.role === "admin", "Admin Login (Campus Admin)", `Role: ${adminLogin.data.user.role}`);

    const analytics = await client.get("/analytics", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    report(
      analytics.status === 200 && typeof analytics.data.totalComplaints === "number",
      "Admin Dashboard Analytics",
      `Total: ${analytics.data.totalComplaints}, Pending: ${analytics.data.pendingComplaints}`,
    );

    const triageRes = await client.patch(
      `/complaints/${createdTicket.id}`,
      {
        status: "in_progress",
        priority: "critical",
        note: "Dispatched HVAC repair team immediately due to electrical hazard.",
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    report(
      triageRes.status === 200 && triageRes.data.status === "in_progress" && triageRes.data.priority === "critical",
      "Admin Triage Workflow (Update Status & Priority)",
      `New Status: ${triageRes.data.status}, Priority: ${triageRes.data.priority}`,
    );
  } catch (err) {
    report(false, "Admin Dashboard & Triage", err.response?.data?.error?.message || err.message);
  }

  // 9. Role-Based Permissions (RBAC Enforcement)
  try {
    // Unauthenticated blocked
    try {
      await axios.get(`${BASE_URL}/audit-logs`);
      report(false, "RBAC: Unauthenticated blocked from /audit-logs");
    } catch (e) {
      report(e.response?.status === 401, "RBAC: Unauthenticated rejected with 401 Unauthorized");
    }

    // Student blocked from admin endpoint
    try {
      await client.get("/audit-logs", {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      report(false, "RBAC: Student blocked from /audit-logs");
    } catch (e) {
      report(e.response?.status === 403, "RBAC: Student blocked from /audit-logs with 403 Forbidden");
    }

    // Admin allowed
    const auditRes = await client.get("/audit-logs", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    report(auditRes.status === 200 && Array.isArray(auditRes.data), "RBAC: Admin successfully retrieves /audit-logs", `${auditRes.data.length} logs recorded`);
  } catch (err) {
    report(false, "Role-Based Permissions", err.response?.data?.error?.message || err.message);
  }

  console.log("\n==================================================================");
  console.log(`WORKFLOW VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error("FATAL ERROR:", e);
  process.exit(1);
});

