/**
 * Phase 3 Student Mobile Features End-to-End Validation Suite
 * Validates the complete Student mobile flow against the running FastAPI backend:
 * 1. Student Authentication & Profile Retrieval
 * 2. Department Listing Integration
 * 3. AI Triage & Classification Integration
 * 4. AI Semantic Duplicate Detection Integration
 * 5. Complaint Submission with Base64 Image
 * 6. Complaint Listing with Student ID filter
 * 7. Complaint Status Filtering (submitted, in_progress, resolved)
 * 8. Search / Query filtering
 * 9. Single Complaint Details with Status Timeline & Department info
 * 10. Duplicate Grouping / Semantic match against created ticket
 * 11. Student Dashboard Metrics Computation
 */

import axios from "axios";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

console.log("==================================================================");
console.log("CAMPUS SIGNAL INTELLIGENCE — PHASE 3 STUDENT MOBILE FLOW TEST");
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

  let studentToken = "";
  let studentUser = null;
  let sampleDepartmentId = "";
  let createdComplaintId = "";
  let createdTicketNumber = "";

  // 1. Authenticate as Seed Student
  try {
    const loginRes = await client.post("/auth/login", {
      email: "student@campus.edu",
      password: "campus123",
      role: "student",
    });

    assert(loginRes.status === 200, "1. Student Login succeeds with status 200");
    assert(!!loginRes.data.accessToken, "2. Access token issued in response");
    assert(loginRes.data.user.role === "student", "3. Logged-in user role is student");

    studentToken = loginRes.data.accessToken;
    studentUser = loginRes.data.user;
    client.defaults.headers.common["Authorization"] = `Bearer ${studentToken}`;
  } catch (err) {
    console.error("Student login failed:", err.response?.data || err.message);
    assert(false, "Student Login", err.message);
    return;
  }

  // 2. Fetch /auth/me to verify session restoration
  try {
    const meRes = await client.get("/auth/me");
    assert(meRes.status === 200, "4. Session restore GET /auth/me returns 200");
    assert(meRes.data.id === studentUser.id, "5. Profile ID matches logged-in user");
    assert(!!meRes.data.studentId, "6. Student ID is present in profile", meRes.data.studentId);
  } catch (err) {
    assert(false, "Profile retrieval", err.message);
  }

  // 3. Department Listing for Complaint Screen Picker
  try {
    const deptsRes = await client.get("/departments");
    assert(deptsRes.status === 200, "7. Fetch departments list returns 200");
    assert(Array.isArray(deptsRes.data), "8. Departments response is an array");
    assert(deptsRes.data.length > 0, "9. At least one department is registered");
    sampleDepartmentId = deptsRes.data[0].id;
    console.log(`    Selected Department: ${deptsRes.data[0].name} (ID: ${sampleDepartmentId})`);
  } catch (err) {
    assert(false, "Fetch departments", err.message);
  }

  // 4. AI Classification Request
  try {
    const classifyRes = await client.post("/ai/classify", {
      title: "Broken AC unit in Science Building Room 302",
      description: "The air conditioner is leaking water and making loud rattling noises. Room is overheated.",
      location: "Science Building Room 302",
    });

    assert(classifyRes.status === 200, "10. AI Classification endpoint returns 200");
    assert(classifyRes.data.category === "facilities", "11. AI classifies HVAC issue as 'facilities'", classifyRes.data.category);
    assert(!!classifyRes.data.priority, "12. AI suggests priority level", classifyRes.data.priority);
    assert(!!classifyRes.data.reasoning, "13. AI returns explainable reasoning", classifyRes.data.reasoning?.slice(0, 40));
  } catch (err) {
    assert(false, "AI Classification", err.message);
  }

  // 5. AI Semantic Duplicate Detection Check
  try {
    const dupRes = await client.post("/ai/detect-duplicates", {
      title: "Broken AC in Science Hall",
      description: "Air conditioner is malfunctioning and leaking.",
      category: "facilities",
      location: "Science Building",
      threshold: 0.4,
    });

    assert(dupRes.status === 200, "14. Semantic duplicate detection returns 200");
    assert(Array.isArray(dupRes.data.matches), "15. Duplicate matches list returned");
    assert(typeof dupRes.data.engine === "string", "16. Engine identifier is reported", dupRes.data.engine);
  } catch (err) {
    assert(false, "AI Duplicate Detection", err.message);
  }

  // 6. Submit Complaint with Base64 Image
  const testTitle = `HVAC Noise & Leakage Test [${Date.now() % 100000}]`;
  const sampleBase64Image = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

  try {
    const createRes = await client.post("/complaints", {
      title: testTitle,
      description: "The laboratory air conditioning unit is vibrating violently and emitting coolant smell.",
      category: "facilities",
      departmentId: sampleDepartmentId,
      location: "Engineering Complex Block C, Room 104",
      imageUrl: sampleBase64Image,
    });

    assert(createRes.status === 201 || createRes.status === 200, "17. Complaint submission returns success");
    assert(!!createRes.data.id, "18. Complaint ID returned", createRes.data.id);
    assert(!!createRes.data.ticket, "19. Complaint Ticket number formatted", createRes.data.ticket);
    assert(createRes.data.status === "submitted", "20. Initial status is 'submitted'");
    assert(createRes.data.imageUrl?.startsWith("data:image/jpeg;base64,"), "21. Base64 image preserved on backend");

    createdComplaintId = createRes.data.id;
    createdTicketNumber = createRes.data.ticket;
  } catch (err) {
    console.error("Complaint creation failed:", err.response?.data || err.message);
    assert(false, "Complaint submission", err.message);
    return;
  }

  // 7. Get Complaints by Student ID
  try {
    const listRes = await client.get(`/complaints?studentId=${studentUser.id}`);
    assert(listRes.status === 200, "22. Fetch student complaints returns 200");
    assert(Array.isArray(listRes.data), "23. List response is an array");
    const found = listRes.data.find((c) => c.id === createdComplaintId);
    assert(!!found, "24. Newly created complaint appears in student complaint list");
  } catch (err) {
    assert(false, "List student complaints", err.message);
  }

  // 8. Filter Complaints by Status
  try {
    const filterRes = await client.get(`/complaints?studentId=${studentUser.id}&status=submitted`);
    assert(filterRes.status === 200, "25. Status filter 'submitted' returns 200");
    const allSubmitted = filterRes.data.every((c) => c.status === "submitted");
    assert(allSubmitted, "26. All returned complaints match filter status 'submitted'");
  } catch (err) {
    assert(false, "Filter complaints by status", err.message);
  }

  // 9. Search Complaints
  try {
    const searchRes = await client.get(`/complaints?studentId=${studentUser.id}&query=${encodeURIComponent("HVAC Noise")}`);
    assert(searchRes.status === 200, "27. Complaint search returns 200");
    const matchesSearch = searchRes.data.some((c) => c.id === createdComplaintId);
    assert(matchesSearch, "28. Search query matches created complaint title");
  } catch (err) {
    assert(false, "Search complaints", err.message);
  }

  // 10. Fetch Complaint Details by ID
  try {
    const detailRes = await client.get(`/complaints/${createdComplaintId}`);
    assert(detailRes.status === 200, "29. GET /complaints/{id} returns 200");
    assert(detailRes.data.ticket === createdTicketNumber, "30. Ticket number matches");
    assert(detailRes.data.title === testTitle, "31. Title matches submitted complaint");
    assert(detailRes.data.departmentId === sampleDepartmentId, "32. Department ID preserved");
    assert(Array.isArray(detailRes.data.updates), "33. Status updates timeline array exists");
    assert(detailRes.data.updates.length >= 1, "34. Initial submission recorded in timeline");
    assert(detailRes.data.updates[0].status === "submitted", "35. Initial timeline status is 'submitted'");
    assert(!!detailRes.data.imageUrl, "36. Uploaded image is available in detail response");
  } catch (err) {
    assert(false, "Complaint details", err.message);
  }

  // 11. Run Semantic Duplicate Check targeting the newly submitted complaint
  try {
    const dupTargetRes = await client.post("/ai/detect-duplicates", {
      title: "HVAC noise and water dripping in lab",
      description: "The AC in Engineering Complex is making vibrating noise and leaking coolant.",
      category: "facilities",
      location: "Engineering Complex",
      threshold: 0.3,
    });

    assert(dupTargetRes.status === 200, "37. Duplicate detection targeting new ticket returns 200");
    const foundDup = dupTargetRes.data.matches.find((m) => m.complaintId === createdComplaintId);
    assert(!!foundDup, "38. AI detects semantic similarity to the newly created ticket", foundDup ? `Similarity: ${Math.round(foundDup.similarityScore * 100)}%` : "None");
  } catch (err) {
    assert(false, "Duplicate detection match", err.message);
  }

  // 12. Student Metrics Breakdown Verification
  try {
    const allRes = await client.get(`/complaints?studentId=${studentUser.id}`);
    const items = allRes.data;
    const total = items.length;
    const pending = items.filter((c) => ["submitted", "in_review", "assigned"].includes(c.status)).length;
    const inProgress = items.filter((c) => c.status === "in_progress").length;
    const resolved = items.filter((c) => ["resolved", "closed"].includes(c.status)).length;

    assert(total === pending + inProgress + resolved, "39. Metrics partition total correctly");
    assert(total >= 1, "40. Total student complaints count is >= 1", `Total: ${total}, Pending: ${pending}`);
  } catch (err) {
    assert(false, "Metrics computation", err.message);
  }

  console.log("\n==================================================================");
  console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
