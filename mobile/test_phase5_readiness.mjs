/**
 * Phase 5 Mobile Production Readiness & Full Cross-Platform Validation Suite
 * Validates:
 * 1. Dual Network Reachability (Localhost + Local LAN Wi-Fi IP for real devices)
 * 2. Mobile Authentication & Real Email OTP Registration Lifecycle
 * 3. Student Session Persistence & Token Claims
 * 4. Complaint Submission with Image Attachment
 * 5. AI Intelligence (Explainable Classification, Priority, Semantic Duplicate Detection)
 * 6. Live Cross-Platform State Synchronization (Mobile <-> Backend <-> Web shared DB)
 * 7. Admin Operations (Analytics, Triage, Manual Duplicate Grouping, Department Management)
 * 8. Audit Logging & Forensic Provenance
 * 9. RBAC & Security Boundaries on Student and Admin Endpoints
 */

import axios from "axios";

const LAN_API_URL = "http://10.107.161.8:8000/api/v1";
const LOCAL_API_URL = "http://127.0.0.1:8000/api/v1";

console.log("==================================================================");
console.log("CAMPUS SIGNAL INTELLIGENCE — PHASE 5 PRODUCTION READINESS SUITE");
console.log(`LAN Endpoint (Physical Devices): ${LAN_API_URL}`);
console.log(`Localhost Endpoint:              ${LOCAL_API_URL}`);
console.log("==================================================================\n");

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, detail = "") {
  if (condition) {
    console.log(`[PASS] ${testName}${detail ? ` (${detail})` : ""}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` — Error: ${detail}` : ""}`);
    failedCount++;
  }
}

async function runSuite() {
  // 1. Dual Network Reachability Check
  console.log("--- 1. Dual Network Reachability (Physical Device & Simulator) ---");
  try {
    const localHealth = await axios.get(`${LOCAL_API_URL}/health`, { timeout: 20000 });
    assert(localHealth.status === 200, "Localhost reachability verified (127.0.0.1:8000)");
  } catch (err) {
    assert(false, "Localhost reachability", err.message);
  }

  let activeBaseUrl = LOCAL_API_URL;
  try {
    const lanHealth = await axios.get(`${LAN_API_URL}/health`, { timeout: 20000 });
    assert(lanHealth.status === 200, "Physical device LAN reachability verified (10.107.161.8:8000)");
    assert(lanHealth.data.service === "campus-signal-intelligence-api", "API service name verified on LAN");
    activeBaseUrl = LAN_API_URL;
  } catch (err) {
    assert(false, "LAN reachability for physical devices", err.message);
  }

  // Use active client for all further tests (prefers LAN endpoint for real mobile device simulation)
  const client = axios.create({
    baseURL: activeBaseUrl,
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Mode": "true",
    },
    timeout: 25000,
  });

  // 2. Authentication & Email OTP Registration Flow
  console.log("\n--- 2. Mobile Authentication & Registration Lifecycle ---");
  const randNum = Math.floor(Math.random() * 90000 + 10000);
  const testEmail = `student.phase5.${randNum}@gmail.com`;
  const testStudentId = `STU-5${randNum.toString().slice(-4)}`;

  try {
    // Send OTP via actual endpoint
    const otpRes = await client.post("/auth/send-otp", {
      email: testEmail,
    });

    assert(otpRes.status === 200, "POST /auth/send-otp accepts any valid email (Gmail)", testEmail);
    assert(otpRes.data.cooldownSeconds === 60, "60-second OTP resend cooldown returned");

    // Verify unverified student cannot login yet
    try {
      await client.post("/auth/login", {
        email: testEmail,
        password: "StrongPassword123!",
        role: "student",
      });
      assert(false, "Unverified student should not be able to log in");
    } catch (loginErr) {
      assert(
        loginErr.response?.status === 401 || loginErr.response?.status === 404,
        "Unregistered user rejected prior to OTP completion",
        `HTTP ${loginErr.response?.status}`,
      );
    }
  } catch (err) {
    assert(false, "OTP send step", err.message);
  }

  // 3. Student Login & Session Restoration
  console.log("\n--- 3. Student Session Persistence & Profile Restoration ---");
  let studentToken = "";
  let studentUser = null;

  try {
    const studentLogin = await client.post("/auth/login", {
      email: "student@campus.edu",
      password: "campus123",
      role: "student",
    });

    assert(studentLogin.status === 200, "Seed student login succeeds");
    assert(!!studentLogin.data.accessToken, "JWT Access token issued");
    studentToken = studentLogin.data.accessToken;
    studentUser = studentLogin.data.user;

    // Simulate session restoration using saved JWT
    const restoreRes = await client.get("/auth/me", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(restoreRes.status === 200, "Session restoration /auth/me returns 200");
    assert(restoreRes.data.email === studentUser.email, "Restored profile email matches");
    assert(restoreRes.data.role === "student", "Restored profile role is student");
  } catch (err) {
    assert(false, "Student login/restore", err.message);
  }

  // 4. Student Complaint Submission with Camera/Gallery Image
  console.log("\n--- 4. Student Complaint Submission with Image Attachment ---");
  let createdTicketId = "";
  let createdTicketNumber = "";
  const sampleBase64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  try {
    const depts = await client.get("/departments");
    const deptId = depts.data[0]?.id || "facilities-dept";

    const submitRes = await client.post(
      "/complaints",
      {
        title: "Broken outdoor lighting behind library causing safety hazard",
        description: "Streetlights are completely dead along the south footpath near the library. Very dark at night.",
        category: "safety",
        departmentId: deptId,
        location: "South Library Walkway",
        imageUrl: sampleBase64,
      },
      { headers: { Authorization: `Bearer ${studentToken}` } },
    );

    assert(submitRes.status === 201 || submitRes.status === 200, "POST /complaints succeeds");
    assert(!!submitRes.data.id, "Ticket ID generated", submitRes.data.id);
    assert(submitRes.data.ticket.startsWith("CSI-"), "Ticket conforms to CSI-XXXX pattern", submitRes.data.ticket);
    assert(submitRes.data.imageUrl === sampleBase64, "Base64 image stored and preserved");

    createdTicketId = submitRes.data.id;
    createdTicketNumber = submitRes.data.ticket;
  } catch (err) {
    assert(false, "Complaint submission", err.message);
  }

  // 5. AI Classification, Priority, & Semantic Duplicates
  console.log("\n--- 5. AI Classification, Priority, and Semantic Duplicate Detection ---");
  try {
    const aiRes = await client.post(
      "/ai/classify",
      {
        title: "Broken outdoor lighting behind library causing safety hazard",
        description: "Dark alleyway with broken fixture poses trip hazard and danger at night.",
        location: "South Library Walkway",
      },
      { headers: { Authorization: `Bearer ${studentToken}` } },
    );

    assert(aiRes.status === 200, "AI Classification endpoint returns 200");
    assert(aiRes.data.category === "safety", "AI classified category as 'safety'");
    assert(typeof aiRes.data.urgencyScore === "number", "AI computed urgency score", `${Math.round(aiRes.data.urgencyScore * 100)}%`);
    assert(!!aiRes.data.reasoning, "AI provided explainability reasoning");

    // Detect duplicate against the newly created ticket
    const dupRes = await client.post(
      "/ai/detect-duplicates",
      {
        title: "Dead streetlights near library path",
        description: "Lamp post broken along the south library walkway.",
        category: "safety",
      },
      { headers: { Authorization: `Bearer ${studentToken}` } },
    );

    assert(dupRes.status === 200, "AI Duplicate Detection returns 200");
    assert(dupRes.data.matches.length > 0, "Semantic duplicate matches found", `${dupRes.data.matches.length} match(es)`);
    assert(dupRes.data.topSimilarity > 0.5, "High semantic similarity detected", `${Math.round(dupRes.data.topSimilarity * 100)}%`);
  } catch (err) {
    assert(false, "AI intelligence evaluation", err.message);
  }

  // 6. Cross-Platform State Synchronization (Student -> Admin -> Student)
  console.log("\n--- 6. Cross-Platform State Synchronization (Mobile <-> Web <-> DB) ---");
  let adminToken = "";
  try {
    // Admin login
    const adminLogin = await client.post("/auth/login", {
      email: "admin@campus.edu",
      password: "campus123",
      role: "admin",
    });
    adminToken = adminLogin.data.accessToken;
    assert(adminLogin.status === 200, "Admin login succeeds");

    // Admin fetches all complaints and locates the student's new ticket
    const adminList = await client.get("/complaints", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const foundByAdmin = adminList.data.find((c) => c.id === createdTicketId);
    assert(!!foundByAdmin, "Admin can immediately view the mobile-submitted complaint", createdTicketNumber);

    // Admin triage update: change status to 'in_progress' and set priority to 'high'
    const patchRes = await client.patch(
      `/complaints/${createdTicketId}`,
      {
        status: "in_progress",
        priority: "high",
        note: "Campus security patrol alerted and electrical contractor scheduled.",
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    assert(patchRes.status === 200, "Admin updates complaint status via PATCH");

    // Student refreshes complaint details and observes the admin's changes in real time
    const studentVerify = await client.get(`/complaints/${createdTicketId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(studentVerify.data.status === "in_progress", "Student mobile immediately reflects synchronized status: in_progress");
    assert(studentVerify.data.priority === "high", "Student mobile immediately reflects synchronized priority: high");
    assert(
      studentVerify.data.updates.some((u) => u.note.includes("Campus security patrol")),
      "Student mobile receives admin triage note in status timeline",
    );
  } catch (err) {
    assert(false, "Cross-platform synchronization", err.message);
  }

  // 7. Admin Analytics & Duplicate Cluster Grouping
  console.log("\n--- 7. Admin Analytics & Manual Duplicate Consolidation ---");
  try {
    const stats = await client.get("/analytics", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(stats.status === 200, "GET /analytics returns 200");
    assert(stats.data.totalComplaints > 0, "Live analytics reflects actual database complaint count", `Total: ${stats.data.totalComplaints}`);

    // Create another duplicate ticket to verify manual grouping
    const depts = await client.get("/departments");
    const dupTicket = await client.post(
      "/complaints",
      {
        title: "South walkway lights completely out",
        description: "Footpath is dark near library.",
        category: "safety",
        departmentId: depts.data[0]?.id || "facilities-dept",
        location: "South Walkway",
      },
      { headers: { Authorization: `Bearer ${studentToken}` } },
    );

    // Manual admin grouping
    const groupRes = await client.post(
      "/complaints/group",
      {
        primaryId: createdTicketId,
        secondaryId: dupTicket.data.id,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    assert(groupRes.status === 200, "Admin manual duplicate grouping returns 200");
    assert(groupRes.data[0].duplicateGroupId === groupRes.data[1].duplicateGroupId, "Complaints share identical duplicate group ID");
  } catch (err) {
    assert(false, "Admin analytics/grouping", err.message);
  }

  // 8. Department Management & Audit Trails
  console.log("\n--- 8. Department Directory & Forensic Audit Trails ---");
  try {
    const deptCode = "P5" + Math.floor(Math.random() * 89 + 10);
    const newDept = await client.post(
      "/departments",
      {
        name: `Production Unit ${deptCode}`,
        code: deptCode,
        head: "Dr. Rachel Green",
        email: `unit.${deptCode.toLowerCase()}@campus.edu`,
        active: true,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    assert(newDept.status === 201, "Admin creates new department via POST /departments");

    const auditRes = await client.get("/audit-logs", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(auditRes.status === 200, "GET /audit-logs returns 200");
    assert(auditRes.data.length > 0, "Audit logs contain recorded operations", `${auditRes.data.length} records`);
    assert(auditRes.data.some((l) => l.action.includes("department")), "Audit trail contains department creation event");
  } catch (err) {
    assert(false, "Department & audit logs", err.message);
  }

  // 9. RBAC Security Barriers
  console.log("\n--- 9. Role-Based Access Control (RBAC) Enforcement ---");
  try {
    // Unauthenticated rejection
    try {
      await axios.get(`${activeBaseUrl}/audit-logs`);
      assert(false, "Unauthenticated request should return 401");
    } catch (unauthErr) {
      assert(unauthErr.response?.status === 401, "Unauthenticated request rejected with 401 Unauthorized");
    }

    // Student attempting admin operations
    try {
      await client.get("/audit-logs", {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert(false, "Student should not access audit logs");
    } catch (forbidErr) {
      assert(forbidErr.response?.status === 403, "Student blocked from /audit-logs with 403 Forbidden");
    }

    try {
      await client.get("/ai/suggested-duplicates", {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert(false, "Student should not access suggested duplicates");
    } catch (forbidErr) {
      assert(forbidErr.response?.status === 403, "Student blocked from /ai/suggested-duplicates with 403 Forbidden");
    }
  } catch (err) {
    assert(false, "RBAC enforcement check", err.message);
  }

  // Summary
  console.log("\n==================================================================");
  console.log(`PHASE 5 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("FATAL ERROR IN SUITE:", err);
  process.exit(1);
});
