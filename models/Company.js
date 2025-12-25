// models/Company.js
const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    code: { type: String, unique: true }, // optional
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", CompanySchema);
