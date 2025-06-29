const mongoose = require("mongoose");


const DayScheduleSchema = new mongoose.Schema({
  date: { type: String, required: true }, // format "YYYY-MM-DD"
  available: [String],
  reserved: [String],
});

const DoctorSchedule = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    doctorName: { type: String, required: true },
    schedules: [DayScheduleSchema],
  },
  { timestamps: true }
);


module.exports = mongoose.model("SchedulePerDoctor", DoctorSchedule);

