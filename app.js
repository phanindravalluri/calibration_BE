// app.js
require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const mongoose = require("mongoose");
const path = require("path");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const productRoutes = require("./routes/products");

const app = express();
const PORT = process.env.PORT || 4000;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev_secret";
const COOKIE_NAME = process.env.COOKIE_NAME || "session";
const FRONTEND_ORIGINS =
  process.env.FRONTEND_ORIGINS || `http://localhost:${PORT}`;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/myapp";

const allowedOrigins = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(express.json());
app.use(cookieParser());

// IMPORTANT: CORS must allow credentials and exact origin if Swagger is hosted elsewhere.
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow Postman, mobile apps

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS blocked: " + origin));
    },
    credentials: true,
  })
);

// logout clears cookie
app.post("/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

// middleware to check cookie (used to protect selected routes)
function requireAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const payload = jwt.verify(token, SESSION_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

// protected test endpoint
app.get("/protected", requireAuth, (req, res) => {
  res.json({ message: `Hello ${req.user.username}`, user: req.user });
});

// serve uploaded files statically (optional)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------- Route mounting: keep auth public, protect users/products ----------
app.use("/auth", authRoutes); // signup, login, me — public endpoints in auth.js handle cookies
app.use("/users", requireAuth, userRoutes); // admin-only create user route inside users.js also checks role
app.use("/products", productRoutes); // create product protected; you might allow GET product routes to be public inside file

/* --------------- Swagger config (OpenAPI 3 + cookieAuth) --------------- */
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Demo API with httpOnly cookie auth",
    version: "1.0.0",
  },
  servers: [{ url: `http://localhost:${PORT}`, description: "Local" }],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: COOKIE_NAME,
      },
    },
  },
};

const routeGlob = path
  .join(__dirname, "routes", "**", "*.js")
  .replace(/\\/g, "/");

const options = {
  swaggerDefinition,
  apis: [routeGlob, __filename],
};

const swaggerSpec = swaggerJSDoc(options);

const swaggerUiOptions = {
  swaggerOptions: {
    // Ensure Swagger UI sends cookies with requests from browser
    requestInterceptor: (req) => {
      req.credentials = "include";
      return req;
    },
    docExpansion: "none",
  },
};

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerUiOptions)
);

// expose spec to inspect easily
app.get("/swagger.json", (req, res) => res.json(swaggerSpec));

/* ----------------- MongoDB connection & optional seed ----------------- */
async function startServer() {
  try {
    // connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
