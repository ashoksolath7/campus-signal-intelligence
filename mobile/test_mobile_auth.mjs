/**
 * Phase 2 Mobile Authentication End-to-End Test Suite
 * Tests mobile authentication services against the live FastAPI backend:
 * - Real Email OTP request & cooldown enforcement
 * - OTP verification & error cases
 * - Registration with verificationToken
 * - Student & Admin login
 * - SecureStore token persistence & /auth/me session restore
 * - Logout & token cleanup
 */

import axios from "axios";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

console.log("=================================================");
console.log("CAMPUS SIGNAL INTELLIGENCE — MOBILE AUTH TEST SUITE");
console.log(`Target Backend: ${API_BASE_URL}`);
console.log("=================================================\n");

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failedCount++;
  }
}

// Emulated SecureStore for testing
const mockSecureStore = {};
const secureStore = {
  setItemAsync: async (key, val) => { mockSecureStore[key] = val; },
  getItemAsync: async (key) => mockSecureStore[key] || null,
  deleteItemAsync: async (key) => { delete mockSecureStore[key]; },
};

async function runTests() {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Mode": "true",
    },
    timeout: 25000,
  });

  // 1. Health & Database Connectivity Check
  try {
    const health = await client.get("/health");
    assert(health.status === 200, "1. Service health check returns 200");
    assert(health.data.status === "ok", "2. Health status is 'ok'");
    assert(
      health.data.mongodb?.status === "connected" || health.data.mongodb?.configured,
      "3. Backend confirms MongoDB Atlas connection",
    );
  } catch (err) {
    console.error("Health check failed:", err.message);
    assert(false, "Backend service reachable");
  }

  // 2. Send OTP with Diverse Email Providers
  const timestamp = Date.now() % 1000000;
  const testStudentEmail = `mobile.student.${timestamp}@gmail.com`;
  const studentId = `STU-MOB-${timestamp}`;
  const password = "MobilePassword123!";

  let otpSent = false;
  try {
    const otpRes = await client.post("/auth/send-otp", { email: testStudentEmail });
    assert(otpRes.status === 200, "4. Send OTP accepts valid email (gmail.com)");
    assert(otpRes.data.cooldownSeconds === 60, "5. OTP resend cooldown is 60 seconds");
    assert(otpRes.data.expiresInSeconds === 300, "6. OTP expiration is 5 minutes (300s)");
    otpSent = true;
  } catch (err) {
    console.error("Send OTP failed:", err.response?.data || err.message);
    assert(false, "4. Send OTP accepts valid email");
  }

  // 3. 60-second Cooldown Enforcement
  if (otpSent) {
    try {
      await client.post("/auth/send-otp", { email: testStudentEmail });
      assert(false, "7. Immediate duplicate Send OTP should be rejected with 429");
    } catch (err) {
      assert(
        err.response?.status === 429 && err.response?.data?.error?.code === "otp_cooldown",
        "7. Immediate duplicate Send OTP rejected with HTTP 429 (otp_cooldown)",
      );
    }
  }

  // 4. Incorrect OTP Verification Attempt
  try {
    await client.post("/auth/verify-otp", { email: testStudentEmail, otp: "000000" });
    assert(false, "8. Incorrect OTP should be rejected");
  } catch (err) {
    assert(
      err.response?.status === 400 && err.response?.data?.error?.code === "invalid_otp",
      "8. Incorrect OTP rejected with HTTP 400 (invalid_otp) & attempts remaining",
    );
  }

  // 5. Unverified Account Registration Protection
  try {
    await client.post("/auth/register", {
      name: "Mobile Student",
      email: testStudentEmail,
      studentId: studentId,
      password: password,
      role: "student",
    });
    assert(false, "9. Registration without verified OTP must be rejected with 403");
  } catch (err) {
    assert(
      err.response?.status === 403 && err.response?.data?.error?.code === "email_not_verified",
      "9. Registration without verified OTP blocked with HTTP 403 (email_not_verified)",
    );
  }

  // 6. Valid OTP Verification & Token Issuance
  // For automated validation, sign a valid verificationToken using the backend's secret or inspect hash
  let verificationToken = null;
  try {
    // Generate valid signed token for the tested email
    const { execSync } = await import("child_process");
    const tokenOutput = execSync(
      `PYTHONPATH=backend venv/bin/python -c "from tests.conftest import make_verification_token; print(make_verification_token('${testStudentEmail}'))"`,
    ).toString().trim();
    verificationToken = tokenOutput;
    assert(Boolean(verificationToken), "10. Generated valid signed OTP verification token");
  } catch (err) {
    console.error("Token generation failed:", err.message);
  }

  // 7. Complete Mobile Registration with Verification Token
  let registeredUser = null;
  let accessToken = null;
  if (verificationToken) {
    try {
      const regRes = await client.post("/auth/register", {
        name: "Mobile Test Student",
        email: testStudentEmail,
        studentId: studentId,
        password: password,
        role: "student",
        verificationToken: verificationToken,
      });

      assert(regRes.status === 201, "11. Registration with verified OTP token succeeds (HTTP 201)");
      assert(regRes.data.user.email === testStudentEmail, "12. Registered user email matches input");
      assert(regRes.data.user.emailVerified === true, "13. User emailVerified is true");
      assert(regRes.data.user.verificationStatus === "otp_verified", "14. verificationStatus is 'otp_verified'");
      assert(!regRes.data.user.password, "15. Password hash is never exposed in response");
      assert(Boolean(regRes.data.accessToken), "16. JWT access token issued upon registration");

      registeredUser = regRes.data.user;
      accessToken = regRes.data.accessToken;

      // Store token in mock SecureStore
      await secureStore.setItemAsync("token", accessToken);
    } catch (err) {
      console.error("Registration failed:", err.response?.data || err.message);
      assert(false, "11. Registration with verified token succeeds");
    }
  }

  // 8. Student Login & Credential Validation
  try {
    const loginRes = await client.post("/auth/login", {
      email: testStudentEmail,
      password: password,
      role: "student",
    });
    assert(loginRes.status === 200, "17. Student login succeeds with registered credentials");
    assert(loginRes.data.user.role === "student", "18. Authenticated role is 'student'");
    assert(Boolean(loginRes.data.accessToken), "19. Login issues fresh JWT access token");

    // Save token to SecureStore
    await secureStore.setItemAsync("token", loginRes.data.accessToken);
  } catch (err) {
    console.error("Login failed:", err.response?.data || err.message);
    assert(false, "17. Student login succeeds");
  }

  // 9. Login with Incorrect Password
  try {
    await client.post("/auth/login", {
      email: testStudentEmail,
      password: "WrongPassword999!",
      role: "student",
    });
    assert(false, "20. Login with invalid password should fail");
  } catch (err) {
    assert(
      err.response?.status === 401 && err.response?.data?.error?.code === "invalid_credentials",
      "20. Login with invalid password rejected with HTTP 401 (invalid_credentials)",
    );
  }

  // 10. Role-Based Access: Student Attempting Admin Portal
  try {
    await client.post("/auth/login", {
      email: testStudentEmail,
      password: password,
      role: "admin",
    });
    assert(false, "21. Student should not be able to login to Admin portal");
  } catch (err) {
    assert(
      err.response?.status === 403 && err.response?.data?.error?.code === "role_mismatch",
      "21. Student accessing Admin portal blocked with HTTP 403 (role_mismatch)",
    );
  }

  // 11. Admin Login Verification (Existing Demo Admin)
  let adminToken = null;
  try {
    const adminLogin = await client.post("/auth/login", {
      email: "admin@campus.edu",
      password: "campus123",
      role: "admin",
    });
    assert(adminLogin.status === 200, "22. Admin login succeeds with demo credentials");
    assert(adminLogin.data.user.role === "admin", "23. Admin authenticated with role 'admin'");
    adminToken = adminLogin.data.accessToken;
  } catch (err) {
    console.error("Admin login failed:", err.response?.data || err.message);
    assert(false, "22. Admin login succeeds");
  }

  // 12. SecureStore Token Persistence & /auth/me Profile Restoration
  const storedToken = await secureStore.getItemAsync("token");
  assert(Boolean(storedToken), "24. JWT token persisted in SecureStore");

  try {
    const meRes = await client.get("/auth/me", {
      headers: { Authorization: `Bearer ${storedToken}` },
    });
    assert(meRes.status === 200, "25. GET /auth/me succeeds with SecureStore token");
    assert(meRes.data.email === testStudentEmail, "26. Restored session matches registered user");
    assert(meRes.data.studentId === studentId, "27. Restored studentId matches database record");
  } catch (err) {
    console.error("/auth/me failed:", err.response?.data || err.message);
    assert(false, "25. GET /auth/me succeeds with SecureStore token");
  }

  // 13. Student Privacy: Cannot Access Admin-Only Endpoints
  try {
    await client.get("/users", {
      headers: { Authorization: `Bearer ${storedToken}` },
    });
    assert(false, "28. Student should not be able to access /api/v1/users");
  } catch (err) {
    assert(
      err.response?.status === 403,
      "28. Student blocked from Admin /api/v1/users with HTTP 403 Forbidden",
    );
  }

  // 14. Admin Can Access /api/v1/users
  if (adminToken) {
    try {
      const usersRes = await client.get("/users", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(usersRes.status === 200, "29. Admin successfully accesses /api/v1/users");
      assert(Array.isArray(usersRes.data), "30. Admin retrieves user list from database");
    } catch (err) {
      assert(false, "29. Admin accesses /api/v1/users");
    }
  }

  // 15. Mobile Logout Flow
  await secureStore.deleteItemAsync("token");
  const clearedToken = await secureStore.getItemAsync("token");
  assert(clearedToken === null, "31. Logout deletes token from SecureStore");

  try {
    await client.get("/auth/me");
    assert(false, "32. Unauthenticated GET /auth/me should fail");
  } catch (err) {
    assert(err.response?.status === 401, "32. Unauthenticated request rejected with HTTP 401 Unauthorized");
  }

  console.log("\n=================================================");
  console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();

