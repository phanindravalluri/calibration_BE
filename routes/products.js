// routes/products.js
const express = require("express");
const multer = require("multer");
const Product = require("../models/Product");
const { requireAuth, requireRole } = require("../middleware/auth");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const router = express.Router();

// base uploads dir
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* ---------------- HELPER FUNCTIONS ---------------- */

function safeUnlink(filePath) {
  try {
    if (!filePath) return;

    let rel = filePath.startsWith("/") ? filePath.slice(1) : filePath;
    if (!rel.startsWith("uploads/")) {
      rel = path.join("uploads", rel.replace(/^\/?uploads\/?/, ""));
    }

    const abs = path.join(UPLOADS_DIR, path.relative("uploads", rel));

    if (!abs.startsWith(UPLOADS_DIR)) {
      console.warn("safeUnlink: blocked unsafe path", filePath);
      return;
    }

    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (err) {
    console.warn("safeUnlink error:", err);
  }
}

/* ---------------- MULTER STORAGE (NO UNIQUE SUFFIX) ---------------- */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const owner = req.query.owner;

    const safeOwner = String(owner);
    const ownerDir = path.join(UPLOADS_DIR, safeOwner);

    try {
      if (!fs.existsSync(ownerDir)) fs.mkdirSync(ownerDir, { recursive: true });
      cb(null, ownerDir);
    } catch (err) {
      console.error("mkdir error:", err);
      cb(err);
    }
  },

  filename: (req, file, cb) => {
    const orig = file.originalname || "file";
    const ext = path.extname(orig);
    const base = path
      .basename(orig, ext)
      .replace(/\s+/g, "_")
      .replace(/[^\w-_.]/g, "");

    const filename = `${base}${ext}`;
    // Remove existing file with same name (overwrite)
    const owner = req.query.owner;
    const safeOwner = String(owner);

    const abs = path.join(UPLOADS_DIR, safeOwner, filename);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);

    cb(null, filename);
  },
});

const upload = multer({ storage });

/* ---------------- ROUTES ---------------- */

/**
 * POST /products
 */
router.post("/", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const { name, description } = req.body;
    const owner = req.query?.owner || "anonymous";
    if (!name) return res.status(400).json({ error: "Missing product name" });

    const product = new Product({
      owner: owner,
      name,
      description: description || "",
      files: [],
    });

    if (req.file) {
      product.files.push({
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: `/uploads/${owner}/${req.file.filename}`,
      });
    }

    await product.save();
    return res.status(201).json({ product });
  } catch (err) {
    console.error("create product error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /products/:id — update product and replace file
 */
router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  upload.single("file"),
  async (req, res) => {
    try {
      const { name, description } = req.body;
      const owner = req.query?.owner || "anonymous";
      const update = {};
      if (name !== undefined) update.name = name;
      if (description !== undefined) update.description = description;
      if (owner !== undefined) update.owner = owner;

      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ error: "Not found" });

      if (req.file) {
        // remove old files
        for (const f of product.files) safeUnlink(f.path);

        product.files = [
          {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: `/uploads/${owner}/${req.file.filename}`,
          },
        ];
      }

      Object.assign(product, update);
      await product.save();

      return res.json({ product });
    } catch (err) {
      console.error("update product error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * DELETE /products/:id
 */
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ error: "Not found" });

    for (const f of product.files) safeUnlink(f.path);

    await Product.deleteOne({ _id: req.params.id });
    return res.json({ ok: true });
  } catch (err) {
    console.error("delete product error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /products/user/:id
 */
router.get("/user/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const filter = mongoose.Types.ObjectId.isValid(id)
      ? { owner: new mongoose.Types.ObjectId(id) }
      : { owner: id };

    const products = await Product.find(filter)
      .populate("owner", "email username role")
      .lean();

    return res.json({ products });
  } catch (err) {
    console.error("user products err", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
