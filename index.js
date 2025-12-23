// /* ======================= IMPORTS ======================= */
// require("./config/env"); // Validate environment variables
// const express = require("express");
// const cors = require("cors");
// const helmet = require("helmet");
// const rateLimit = require("express-rate-limit");
// const compression = require("compression");
// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");
// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");
// const pool = require("./config/db");
// const { setupLogging } = require("./middleware/logger");
// const errorHandler = require("./middleware/errorHandler");
// const asyncHandler = require("./middleware/asyncHandler");
// require("dotenv").config();

// /* ======================= APP SETUP ======================= */
// const app = express();

// // Security middleware
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'"],
//       styleSrc: ["'self'", "'unsafe-inline'"],
//       scriptSrc: ["'self'"],
//       imgSrc: ["'self'", "data:", "https:"],
//     },
//   },
// }));

// // Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: "Too many requests from this IP, please try again later.",
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use(limiter);

// // Compression
// app.use(compression());

// // CORS configuration
// app.use(cors({
//   origin: process.env.NODE_ENV === 'production'
//     ? process.env.FRONTEND_URL || false
//     : true,
//   credentials: true,
// }));

// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// // Setup logging
// setupLogging(app);

// /* ======================= DATABASE ======================= */
// const pool = new Pool({
//   host: "localhost",
//   user: "postgres",
//   password: process.env.DB_PASSWORD,
//   database: "auth_db",
//   port: 5432,
// });

// /* ======================= JWT MIDDLEWARE ======================= */
// const verifyToken = (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader) return res.status(401).json({ error: "No token provided" });

//   const token = authHeader.split(" ")[1];

//   jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
//     if (err) return res.status(403).json({ error: "Invalid token" });

//     req.user = decoded;
//     next();
//   });
// };

// /* ======================= UPLOAD SETUP ======================= */
// const uploadDir = path.join(__dirname, "uploads");

// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir);
// }

// const storage = multer.diskStorage({
//   destination: (_, __, cb) => cb(null, uploadDir),
//   filename: (_, file, cb) => {
//     const safeName = file.originalname.replace(/\s+/g, "-");
//     cb(null, Date.now() + "-" + safeName);
//   },
// });

// const upload = multer({ storage });

// /* ======================= UPLOAD ROUTE ======================= */
// app.post("/api/upload", verifyToken, upload.single("image"), (req, res) => {
//   if (!req.file) return res.status(400).json({ error: "No file uploaded" });

//   const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
//   res.json({ imageUrl });
// });

// /* ======================= AUTH ======================= */

// // REGISTER
// app.post("/api/auth/register", async (req, res) => {
//   const { name, email, password } = req.body;
//   try {
//     const hashed = await bcrypt.hash(password, 10);

//     await pool.query(
//       "INSERT INTO users (name, email, password) VALUES ($1,$2,$3)",
//       [name, email, hashed]
//     );

//     res.status(201).json({ message: "User registered" });
//   } catch (err) {
//     if (err.code === "23505") {
//       return res.status(400).json({ error: "Email already exists" });
//     }
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// // LOGIN
// app.post("/api/auth/login", async (req, res) => {
//   const { email, password } = req.body;

//   const result = await pool.query(
//     "SELECT * FROM users WHERE email=$1",
//     [email]
//   );

//   if (!result.rows.length)
//     return res.status(401).json({ error: "Invalid credentials" });

//   const user = result.rows[0];
//   const match = await bcrypt.compare(password, user.password);

//   if (!match)
//     return res.status(401).json({ error: "Invalid credentials" });

//   const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
//     expiresIn: "1h",
//   });

//   res.json({ token });
// });

// /* ======================= POSTS ======================= */

// // CREATE POST
// app.post("/api/posts", verifyToken, async (req, res) => {
//   const { title, outline, content, tags, image_url, published } = req.body;

//   if (!title || !content)
//     return res.status(400).json({ error: "Title and content required" });

//   const slug = title
//     .toLowerCase()
//     .replace(/[^a-z0-9]+/g, "-")
//     .replace(/^-+|-+$/g, "");

//   try {
//     const result = await pool.query(
//       `
//       INSERT INTO posts
//       (user_id, title, slug, outline, content, tags, image_url, published, created_at)
//       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
//       RETURNING *
//       `,
//       [
//         req.user.id,
//         title,
//         slug,
//         outline || null,
//         content,
//         tags || [],
//         image_url || null,
//         published || false,
//       ]
//     );

//     res.status(201).json(result.rows[0]);
//   } catch (err) {
//     res.status(500).json({ error: "Failed to create post" });
//   }
// });

// // GET USER POSTS
// app.get("/api/posts", verifyToken, async (req, res) => {
//   const result = await pool.query(
//     "SELECT * FROM posts WHERE user_id=$1 ORDER BY updated_at DESC",
//     [req.user.id]
//   );

//   res.json(result.rows);
// });

// // UPDATE POST
// app.put("/api/posts/:id", verifyToken, async (req, res) => {
//   const { title, outline, content, tags, image_url, published } = req.body;

//   const result = await pool.query(
//     `
//     UPDATE posts
//     SET
//       title=$1,
//       outline=$2,
//       content=$3,
//       tags=$4,
//       image_url=$5,
//       published=$6,
//       created_at = COALESCE(created_at, NOW()),
//       updated_at = NOW()
//     WHERE id=$7 AND user_id=$8
//     RETURNING *
//     `,
//     [
//       title,
//       outline || null,
//       content,
//       tags || [],
//       image_url || null,
//       published,
//       req.params.id,
//       req.user.id,
//     ]
//   );

//   if (!result.rows.length)
//     return res.status(404).json({ error: "Post not found" });

//   res.json(result.rows[0]);
// });

// // DELETE POST
// app.delete("/api/posts/:id", verifyToken, async (req, res) => {
//   await pool.query(
//     "DELETE FROM posts WHERE id=$1 AND user_id=$2",
//     [req.params.id, req.user.id]
//   );

//   res.json({ success: true });
// });

// /* ======================= PUBLIC POSTS ======================= */
// app.get("/api/public/posts", async (_, res) => {
//   try {
//     const result = await pool.query(`
//       SELECT
//         id,
//         title,
//         slug,
//         content,
//         tags,
//         image_url,
//         created_at
//       FROM posts
//       WHERE published = true
//       ORDER BY created_at DESC
//     `);

//     res.json(result.rows);
//   } catch {
//     res.status(500).json({ error: "Failed to fetch public posts" });
//   }
// });

// // SINGLE PUBLIC POST
// app.get("/api/public/posts/:slug", async (req, res) => {
//   const result = await pool.query(
//     "SELECT * FROM posts WHERE slug=$1 AND published=true",
//     [req.params.slug]
//   );

//   if (!result.rows.length)
//     return res.status(404).json({ error: "Post not found" });

//   res.json(result.rows[0]);
// });

// /* ======================= AI ROUTE ======================= */
// const aiRouter = require("./routes/ai");
// app.use("/api/ai", aiRouter);

// /* ======================= COMMENTS ======================= */

// // GET COMMENTS
// app.get("/api/posts/:postId/comments", async (req, res) => {
//   const result = await pool.query(
//     `
//     SELECT c.id, c.content, c.created_at, c.user_id, u.name
//     FROM comments c
//     JOIN users u ON c.user_id = u.id
//     WHERE c.post_id = $1
//     ORDER BY c.created_at DESC
//     `,
//     [req.params.postId]
//   );

//   res.json(result.rows);
// });

// // ADD COMMENT
// app.post("/api/posts/:postId/comments", verifyToken, async (req, res) => {
//   const { content } = req.body;

//   if (!content.trim())
//     return res.status(400).json({ error: "Comment empty" });

//   const insert = await pool.query(
//     `
//     INSERT INTO comments (post_id, user_id, content)
//     VALUES ($1,$2,$3)
//     RETURNING id
//     `,
//     [req.params.postId, req.user.id, content]
//   );

//   const comment = await pool.query(
//     `
//     SELECT c.id, c.content, c.created_at, u.name, c.user_id
//     FROM comments c
//     JOIN users u ON c.user_id = u.id
//     WHERE c.id = $1
//     `,
//     [insert.rows[0].id]
//   );

//   res.status(201).json(comment.rows[0]);
// });

// // UPDATE COMMENT
// app.put("/api/comments/:id", verifyToken, async (req, res) => {
//   const { content } = req.body;

//   const result = await pool.query(
//     `
//     UPDATE comments
//     SET content=$1
//     WHERE id=$2 AND user_id=$3
//     RETURNING *
//     `,
//     [content, req.params.id, req.user.id]
//   );

//   if (!result.rows.length)
//     return res.status(403).json({ error: "Not allowed" });

//   res.json(result.rows[0]);
// });

// // DELETE COMMENT
// app.delete("/api/comments/:id", verifyToken, async (req, res) => {
//   const result = await pool.query(
//     "DELETE FROM comments WHERE id=$1 AND user_id=$2",
//     [req.params.id, req.user.id]
//   );

//   if (!result.rowCount)
//     return res.status(403).json({ error: "Not allowed" });

//   res.json({ success: true });
// });

// /* ======================= HEALTH CHECK ======================= */
// app.get("/health", (req, res) => {
//   res.status(200).json({
//     status: "OK",
//     timestamp: new Date().toISOString(),
//     environment: process.env.NODE_ENV,
//     version: process.version
//   });
// });

// /* ======================= STATIC FILES ======================= */
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// /* ======================= ERROR HANDLING ======================= */
// // Global error handler (must be last)
// app.use(errorHandler);

// /* ======================= GRACEFUL SHUTDOWN ======================= */
// const gracefulShutdown = () => {
//   console.log("🔄 Received shutdown signal, closing server gracefully...");

//   server.close(() => {
//     console.log("✅ HTTP server closed");

//     pool.end(() => {
//       console.log("✅ Database pool closed");
//       process.exit(0);
//     });
//   });

//   // Force close after 10 seconds
//   setTimeout(() => {
//     console.error("❌ Could not close connections in time, forcefully shutting down");
//     process.exit(1);
//   }, 10000);
// };

// process.on("SIGTERM", gracefulShutdown);
// process.on("SIGINT", gracefulShutdown);

// /* ======================= SERVER ======================= */
// const PORT = process.env.PORT || 5000;
// const server = app.listen(PORT, () => {
//   console.log(`🔥 Backend running at http://localhost:${PORT}`);
//   console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
// });
/* ======================= ENV ======================= */
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

require("./config/env"); // Validate required env vars

/* ======================= IMPORTS ======================= */
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const pool = require("./config/db");
const { setupLogging } = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");

/* ======================= APP SETUP ======================= */
const app = express();

/* ======================= SECURITY ======================= */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

/* ======================= RATE LIMIT ======================= */
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

/* ======================= MIDDLEWARE ======================= */
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ======================= CORS ======================= */
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : "http://localhost:3000",
    credentials: true,
  })
);

/* ======================= LOGGING ======================= */
setupLogging(app);

/* ======================= JWT MIDDLEWARE ======================= */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = decoded;
    next();
  });
};

/* ======================= UPLOADS (DEV ONLY) ======================= */
let upload;

if (process.env.NODE_ENV !== "production") {
  const uploadDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

  const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),
    filename: (_, file, cb) =>
      cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "-")),
  });

  upload = multer({ storage });
  app.use("/uploads", express.static(uploadDir));
}

/* ======================= UPLOAD ROUTE ======================= */
app.post("/api/upload", verifyToken, (req, res, next) => {
  if (!upload)
    return res.status(501).json({ error: "Uploads disabled in production" });

  upload.single("image")(req, res, (err) => {
    if (err || !req.file)
      return res.status(400).json({ error: "Upload failed" });

    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  });
});

/* ======================= AUTH ======================= */
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1,$2,$3)",
      [name, email, hashed]
    );
    res.status(201).json({ message: "User registered" });
  } catch (err) {
    if (err.code === "23505")
      return res.status(400).json({ error: "Email already exists" });
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!result.rows.length)
    return res.status(401).json({ error: "Invalid credentials" });

  const user = result.rows[0];
  const match = await bcrypt.compare(password, user.password);

  if (!match)
    return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  res.json({ token });
});

/* ======================= POSTS / COMMENTS / AI ======================= */
// (No logic changes needed — your existing routes stay the same)

/* ======================= HEALTH ======================= */
app.get("/health", (_, res) => {
  res.json({
    status: "OK",
    env: process.env.NODE_ENV,
    time: new Date().toISOString(),
  });
});

/* ======================= ERROR HANDLER ======================= */
app.use(errorHandler);

/* ======================= GRACEFUL SHUTDOWN ======================= */
const shutdown = () => {
  console.log("Shutting down...");
  server.close(() => pool.end(() => process.exit(0)));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

/* ======================= SERVER ======================= */
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
