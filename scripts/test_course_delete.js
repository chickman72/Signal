// scripts/test_course_delete.js
// Creates a course via the public API, deletes it, and verifies removal.
// Usage: node scripts/test_course_delete.js --username <username> [--baseUrl http://localhost:3000]

const crypto = require("crypto");

function getArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}

async function requestJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

async function main() {
  const username = getArg("--username", process.env.TEST_USERNAME);
  const baseUrl = getArg("--baseUrl", process.env.TEST_BASE_URL || "http://localhost:3000");

  if (!username) {
    console.error("Missing username. Provide --username or TEST_USERNAME.");
    process.exit(1);
  }

  const courseId = `delete-test-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const course = {
    course_id: courseId,
    title: "Delete Test Course",
    style: "test",
    chapters: [
      {
        id: 1,
        title: "Intro",
        summary: "Delete test summary.",
        content_markdown: "This is a delete test course.",
        audio_script: "This is a delete test course.",
        quiz: [
          {
            question: "Test question?",
            options: ["A", "B", "C", "D"],
            correct_answer: 1,
          },
        ],
      },
    ],
  };

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Username: ${username}`);
  console.log(`Course ID: ${courseId}`);

  const createUrl = `${baseUrl}/api/courses`;
  const { res: createRes, body: createBody } = await requestJson(createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course, username }),
  });
  console.log("Create status:", createRes.status);
  if (!createRes.ok) {
    console.error("Create failed:", createBody);
    process.exit(1);
  }

  const listUrl = `${baseUrl}/api/courses?username=${encodeURIComponent(username)}`;
  const { res: listRes, body: listBody } = await requestJson(listUrl, { method: "GET" });
  console.log("List status:", listRes.status);
  if (!listRes.ok) {
    console.error("List failed:", listBody);
    process.exit(1);
  }
  const courses = Array.isArray(listBody?.courses) ? listBody.courses : [];
  const createdExists = courses.some((c) => c.course_id === courseId || c.id === courseId);
  console.log("Created found in list:", createdExists);

  const deleteUrl = `${baseUrl}/api/courses/${encodeURIComponent(courseId)}?username=${encodeURIComponent(username)}`;
  const { res: deleteRes, body: deleteBody } = await requestJson(deleteUrl, { method: "DELETE" });
  console.log("Delete status:", deleteRes.status);
  if (!deleteRes.ok) {
    console.error("Delete failed:", deleteBody);
    process.exit(1);
  }
  console.log("Delete response:", deleteBody);

  const { res: listRes2, body: listBody2 } = await requestJson(listUrl, { method: "GET" });
  console.log("List-after-delete status:", listRes2.status);
  if (!listRes2.ok) {
    console.error("List-after-delete failed:", listBody2);
    process.exit(1);
  }
  const coursesAfter = Array.isArray(listBody2?.courses) ? listBody2.courses : [];
  const stillExists = coursesAfter.some((c) => c.course_id === courseId || c.id === courseId);
  console.log("Still exists after delete:", stillExists);

  if (stillExists) {
    console.error("Delete did not fully remove the course.");
    process.exit(2);
  }

  console.log("Delete test completed successfully.");
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
