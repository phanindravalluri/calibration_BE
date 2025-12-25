const mongoose = require("mongoose");

const CalibrationSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    formData: Object,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Calibration", CalibrationSchema);
