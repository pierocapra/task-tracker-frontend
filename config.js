// ---------------------------------------------------------------------------
// config.js
//
// One base URL per backend stack in the roadmap. Only "node" is live today.
// When you deploy Phase 2/3/4, just fill in the matching URL below —
// nothing else in the app needs to change.
//
// Local dev example:   "http://localhost:3000"
// Deployed example:    "https://task-tracker-node.onrender.com"
// ---------------------------------------------------------------------------

const STACK_CONFIG = {
  node: {
    label: "Node.js",
    baseUrl: "https://task-tracker-express.onrender.com", // <-- replace with your Render URL once deployed
  },
  aspnet: {
    label: "ASP.NET",
    baseUrl: "", // filled in during Phase 2
  },
  django: {
    label: "Django",
    baseUrl: "", // filled in during Phase 3
  },
  spring: {
    label: "Spring Boot",
    baseUrl: "", // filled in during Phase 4
  },
};

// API route shape assumed by app.js — matches the Phase 1 Express/Prisma API.
// If your actual routes differ, adjust these paths (not the logic below).
const API_ROUTES = {
  signup: "/auth/signup",
  login: "/auth/login",
  tasks: "/tasks", // GET (list) / POST (create)
  task: (id) => `/tasks/${id}`, // PUT (update) / DELETE
};
