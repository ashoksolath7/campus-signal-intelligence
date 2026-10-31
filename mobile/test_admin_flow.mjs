/**
 * Phase 4 Admin Mobile Flow & Backend Integration Test Suite
 * Validates the complete Administrative capabilities and security barriers:
 * 1. Security: Student role cannot access admin endpoints (403 Forbidden)
 * 2. Security: Unauthenticated requests are rejected (401 Unauthorized)
 * 3. Admin Authentication: Login as admin & profile restore
 * 4. Admin Dashboard Metrics: Live analytics API & distribution data
 * 5. Complaint Management: Search, filter, and detail view
 * 6. Complaint Triage & Workflow: Patch status, priority, department, and notes
 * 7. AI Intelligence & Explainability: Triage classification and cluster discovery
 * 8. Duplicate Grouping: Manual Admin approval via /complaints/group
 * 9. Department Management: Create department & toggle active status
 * 10. Audit Logging: Fetch audit trail and verify recorded events
 */

import axios from "axios";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

console.log("==================================================================");
console.log("CAMPUS SIGNAL INTELLIGENCE — PHASE 4 ADMIN MOBILE TEST SUITE");
console.log(`Backend Target: ${API_BASE_URL}`);
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

async function runTests() {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Mode": "true",
    },
    timeout: 25000,
  });

  // ==========================================
  // SECTION 1: ROLE-BASED ACCESS CONTROL (RBAC)
  // ==========================================
  console.log("--- 1. RBAC & Security Boundaries ---");

  // A. Unauthenticated checks
  try {
    await client.get("/audit-logs");
    assert(false, "Unauthenticated /audit-logs should fail");
  } catch (err) {
    assert(
      err.response?.status === 401,
      "Unauthenticated /audit-logs returns 401 Unauthorized",
      `HTTP ${err.response?.status}`,
    );
  }

  // B. Student token trying to access admin endpoints
  let studentToken = "";
  try {
    const studentLogin = await client.post("/auth/login", {
      email: "student@campus.edu",
      password: "campus123",
      role: "student",
    });
    studentToken = studentLogin.data.accessToken;
    assert(studentLogin.status === 200, "Student login for RBAC check succeeds");
  } catch (err) {
    assert(false, "Student login failed for RBAC check", err.message);
  }

  const studentClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Mode": "true",
      Authorization: `Bearer ${studentToken}`,
    },
    timeout: 10000,
  });

  // Student forbidden from AI Suggested Duplicates
  try {
    await studentClient.get("/ai/suggested-duplicates");
    assert(false, "Student should not access /ai/suggested-duplicates");
  } catch (err) {
    assert(
      err.response?.status === 403,
      "Student blocked from /ai/suggested-duplicates with 403 Forbidden",
      `HTTP ${err.response?.status}`,
    );
  }

  // Student forbidden from Audit Logs
  try {
    await studentClient.get("/audit-logs");
    assert(false, "Student should not access /audit-logs");
  } catch (err) {
    assert(
      err.response?.status === 403,
      "Student blocked from /audit-logs with 403 Forbidden",
      `HTTP ${err.response?.status}`,
    );
  }

  // Student forbidden from Creating Department
  try {
    await studentClient.post("/departments", {
      name: "Rogue Dept",
      code: "ROG",
      head: "Unknown",
      email: "rogue@campus.edu",
    });
    assert(false, "Student should not create departments");
  } catch (err) {
    assert(
      err.response?.status === 403,
      "Student blocked from POST /departments with 403 Forbidden",
      `HTTP ${err.response?.status}`,
    );
  }

  // ==========================================
  // SECTION 2: ADMIN AUTHENTICATION
  // ==========================================
  console.log("\n--- 2. Admin Authentication & Session ---");
  let adminToken = "";
  let adminUser = null;

  try {
    const adminLogin = await client.post("/auth/login", {
      email: "admin@campus.edu",
      password: "campus123",
      role: "admin",
    });

    assert(adminLogin.status === 200, "Admin login succeeds with status 200");
    assert(!!adminLogin.data.accessToken, "Admin access token issued");
    assert(adminLogin.data.user.role === "admin", "Admin role confirmed in login payload");

    adminToken = adminLogin.data.accessToken;
    adminUser = adminLogin.data.user;
    client.defaults.headers.common["Authorization"] = `Bearer ${adminToken}`;
  } catch (err) {
    console.error("Admin login failed:", err.response?.data || err.message);
    assert(false, "Admin login", err.message);
    return;
  }

  // Verify /auth/me for admin
  try {
    const meRes = await client.get("/auth/me");
    assert(meRes.status === 200, "Admin GET /auth/me returns 200");
    assert(meRes.data.role === "admin", "Role in /auth/me is admin");
    assert(meRes.data.email === "admin@campus.edu", "Admin email matches");
  } catch (err) {
    assert(false, "Admin /auth/me check", err.message);
  }

  // ==========================================
  // SECTION 3: ADMIN DASHBOARD ANALYTICS
  // ==========================================
  console.log("\n--- 3. Admin Analytics & Console Metrics ---");
  try {
    const statsRes = await client.get("/analytics");
    assert(statsRes.status === 200, "GET /analytics returns 200");
    const data = statsRes.data;

    assert(typeof data.totalComplaints === "number", "Total complaints is a number", `${data.totalComplaints}`);
    assert(typeof data.pendingComplaints === "number", "Pending complaints is a number", `${data.pendingComplaints}`);
    assert(typeof data.resolvedComplaints === "number", "Resolved complaints is a number", `${data.resolvedComplaints}`);
    assert(typeof data.criticalComplaints === "number", "Critical complaints is a number", `${data.criticalComplaints}`);
    assert(Array.isArray(data.categoryDistribution), "Category distribution is an array", `${data.categoryDistribution.length} categories`);
    assert(Array.isArray(data.departmentDistribution), "Department distribution is an array", `${data.departmentDistribution.length} departments`);
    assert(Array.isArray(data.priorityDistribution), "Priority distribution is an array", `${data.priorityDistribution.length} priorities`);
    assert(Array.isArray(data.dailyTrends), "Daily trends is an array", `${data.dailyTrends.length} days`);
  } catch (err) {
    assert(false, "Admin analytics check", err.message);
  }

  // ==========================================
  // SECTION 4: COMPLAINT MANAGEMENT & TRIAGE
  // ==========================================
  console.log("\n--- 4. Complaint Management & Workflow Triage ---");
  let targetComplaint = null;

  try {
    const listRes = await client.get("/complaints");
    assert(listRes.status === 200, "GET /complaints returns 200");
    assert(Array.isArray(listRes.data), "Complaints response is an array", `${listRes.data.length} total`);

    if (listRes.data.length > 0) {
      targetComplaint = listRes.data[0];
    } else {
      // Create a test complaint if none exist
      const depts = await client.get("/departments");
      const createRes = await client.post("/complaints", {
        title: "Main quad lamppost flickering and broken fixture",
        description: "Outdoor illumination pole near science library has an exposed wire and flickering bulb.",
        category: "facilities",
        departmentId: depts.data[0]?.id || "facilities-dept",
        location: "Central Campus Quad",
      });
      targetComplaint = createRes.data;
    }

    assert(!!targetComplaint?.id, "Target complaint identified for triage", targetComplaint.ticket);
  } catch (err) {
    assert(false, "Fetch complaints list", err.message);
  }

  // Open complaint details
  try {
    const detailRes = await client.get(`/complaints/${targetComplaint.id}`);
    assert(detailRes.status === 200, "GET /complaints/{id} returns 200");
    assert(detailRes.data.id === targetComplaint.id, "Fetched ID matches requested ID");
    assert(!!detailRes.data.studentEmail, "Submitter email visible to admin");
    assert(Array.isArray(detailRes.data.updates), "Status updates timeline array present");
  } catch (err) {
    assert(false, "Complaint details retrieval", err.message);
  }

  // Triage update: Change status to 'in_progress', priority to 'high', add admin note
  const priorUpdatesCount = targetComplaint.updates?.length || 0;
  try {
    const patchRes = await client.patch(`/complaints/${targetComplaint.id}`, {
      status: "in_progress",
      priority: "high",
      note: "Work order 4410 dispatched to electrical maintenance crew.",
    });

    assert(patchRes.status === 200, "PATCH /complaints/{id} returns 200");
    assert(patchRes.data.status === "in_progress", "Status updated to in_progress");
    assert(patchRes.data.priority === "high", "Priority updated to high");
    assert(patchRes.data.updates.length === priorUpdatesCount + 1, "New update appended to status timeline");

    const latestUpdate = patchRes.data.updates[patchRes.data.updates.length - 1];
    assert(latestUpdate.status === "in_progress", "Latest timeline status is in_progress");
    assert(latestUpdate.actor === adminUser.name, "Timeline entry attributed to admin actor", latestUpdate.actor);
    assert(latestUpdate.note.includes("Work order 4410"), "Timeline note preserved");
  } catch (err) {
    assert(false, "Complaint workflow patch", err.message);
  }

  // ==========================================
  // SECTION 5: AI INTELLIGENCE & EXPLAINABILITY
  // ==========================================
  console.log("\n--- 5. AI Intelligence & Explainability Engine ---");
  try {
    const aiClassify = await client.post("/ai/classify", {
      title: "Emergency: live wire and smoke hazard in building",
      description: "Immediate danger with exposed sparking wire and smoke near lab entrance.",
      location: "Engineering Lab Block B",
    });

    assert(aiClassify.status === 200, "POST /ai/classify returns 200");
    assert(aiClassify.data.priority === "critical", "AI detects critical priority for hazard", aiClassify.data.priority);
    assert(typeof aiClassify.data.urgencyScore === "number", "Urgency score computed", `${Math.round(aiClassify.data.urgencyScore * 100)}%`);
    assert(!!aiClassify.data.reasoning, "AI explainability reasoning provided", aiClassify.data.reasoning.slice(0, 40) + "…");
    assert(!!aiClassify.data.modelUsed, "AI model attribution reported", aiClassify.data.modelUsed);
  } catch (err) {
    assert(false, "AI classification check", err.message);
  }

  // Scan duplicate clusters
  try {
    const dupClusters = await client.get("/ai/suggested-duplicates");
    assert(dupClusters.status === 200, "GET /ai/suggested-duplicates returns 200 for admin");
    assert(Array.isArray(dupClusters.data.suggestedGroups), "Suggested groups is an array");
    assert(typeof dupClusters.data.totalCandidates === "number", "Candidates count is a number", `${dupClusters.data.totalCandidates}`);
    assert(!!dupClusters.data.engine, "AI engine reported", dupClusters.data.engine);
  } catch (err) {
    assert(false, "AI suggested duplicates check", err.message);
  }

  // ==========================================
  // SECTION 6: DUPLICATE MANAGEMENT & GROUPING
  // ==========================================
  console.log("\n--- 6. Duplicate Management & Manual Approval ---");
  try {
    const depts = await client.get("/departments");
    const deptId = depts.data[0]?.id || "facilities-dept";

    // Create 2 related test tickets
    const c1 = await client.post("/complaints", {
      title: "Broken AC unit in Science Hall Room 101",
      description: "Air conditioner leaking condensation water and making grinding noise.",
      category: "facilities",
      departmentId: deptId,
      location: "Science Hall 101",
    });

    const c2 = await client.post("/complaints", {
      title: "Water leaking from air conditioner in Science 101",
      description: "AC is flooding the classroom floor near the whiteboard.",
      category: "facilities",
      departmentId: deptId,
      location: "Science Hall 101",
    });

    // Group the complaints
    const groupRes = await client.post("/complaints/group", {
      primaryId: c1.data.id,
      secondaryId: c2.data.id,
    });

    assert(groupRes.status === 200, "POST /complaints/group returns 200");
    assert(Array.isArray(groupRes.data), "Group response is an array of updated complaints");
    assert(groupRes.data.length >= 2, "Both complaints returned in group response");

    const updatedC1 = groupRes.data.find((c) => c.id === c1.data.id);
    const updatedC2 = groupRes.data.find((c) => c.id === c2.data.id);

    assert(!!updatedC1?.duplicateGroupId, "Primary complaint assigned duplicateGroupId", updatedC1?.duplicateGroupId);
    assert(updatedC1?.duplicateGroupId === updatedC2?.duplicateGroupId, "Both complaints share exact same duplicateGroupId");
  } catch (err) {
    assert(false, "Duplicate grouping check", err.message);
  }

  // ==========================================
  // SECTION 7: DEPARTMENT MANAGEMENT
  // ==========================================
  console.log("\n--- 7. Department Directory Management ---");
  let testDeptId = "";
  try {
    const randCode = "TST" + Math.floor(Math.random() * 899 + 100);
    const createDeptRes = await client.post("/departments", {
      name: `Test Facility Unit ${randCode}`,
      code: randCode,
      head: "Dean Marcus Stone",
      email: `facility.${randCode.toLowerCase()}@campus.edu`,
      active: true,
    });

    assert(createDeptRes.status === 201, "POST /departments returns 201 Created");
    assert(createDeptRes.data.code === randCode, "Department code saved correctly");
    assert(createDeptRes.data.active === true, "Department active status defaults to true");
    testDeptId = createDeptRes.data.id;

    // Toggle active status to false
    const deactRes = await client.patch(`/departments/${testDeptId}`, {
      active: false,
    });
    assert(deactRes.status === 200, "PATCH /departments/{id} returns 200 for deactivation");
    assert(deactRes.data.active === false, "Department active status toggled to false");

    // Toggle back to active: true
    const reactRes = await client.patch(`/departments/${testDeptId}`, {
      active: true,
    });
    assert(reactRes.status === 200, "PATCH /departments/{id} returns 200 for reactivation");
    assert(reactRes.data.active === true, "Department reactivated to true");
  } catch (err) {
    assert(false, "Department management check", err.message);
  }

  // ==========================================
  // SECTION 8: AUDIT TRAILS
  // ==========================================
  console.log("\n--- 8. Audit Logs & Forensic Provenance ---");
  try {
    const auditRes = await client.get("/audit-logs");
    assert(auditRes.status === 200, "GET /audit-logs returns 200");
    assert(Array.isArray(auditRes.data), "Audit logs response is an array", `${auditRes.data.length} logs recorded`);

    if (auditRes.data.length > 0) {
      const sample = auditRes.data[0];
      assert(!!sample.id, "Audit record has ID");
      assert(!!sample.at, "Audit record has timestamp", sample.at);
      assert(!!sample.actor, "Audit record has actor name", sample.actor);
      assert(!!sample.action, "Audit record has action name", sample.action);
      assert(!!sample.detail, "Audit record has descriptive detail");
    }

    // Verify recent actions like update_complaint and create_department are recorded
    const actions = auditRes.data.map((l) => l.action);
    const hasUpdateComplaint = actions.some((a) => a.includes("complaint"));
    const hasDeptAction = actions.some((a) => a.includes("department"));

    assert(hasUpdateComplaint, "Audit trail contains complaint workflow actions");
    assert(hasDeptAction, "Audit trail contains department management actions");
  } catch (err) {
    assert(false, "Audit logs retrieval", err.message);
  }

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log("\n==================================================================");
  console.log(`PHASE 4 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
