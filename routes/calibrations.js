const express = require("express");
const router = express.Router();
const Calibration = require("../models/Calibration");

/** CREATE */
router.post("/", async (req, res) => {
  const doc = await Calibration.create(req.body);
  res.status(201).json(doc);
});

/** LIST WITH STATUS FILTER */
router.get("/", async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const skip = (page - 1) * limit;

  const { status, companyId } = req.query;

  const filter = {};
  if (status && status !== "ALL") {
    filter["formData.reviewStatus"] = status;
  }
  if (companyId) {
    filter.companyId = companyId;
  }

  const [data, total] = await Promise.all([
    Calibration.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Calibration.countDocuments(filter),
  ]);

  res.json({
    data,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  });
});

/** GET BY ID */
router.get("/:id", async (req, res) => {
  const doc = await Calibration.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: "Not found" });
  res.json(doc);
});

/** UPDATE */
router.put("/:id", async (req, res) => {
  const doc = await Calibration.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(doc);
});

/** DELETE */
router.delete("/:id", async (req, res) => {
  await Calibration.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
