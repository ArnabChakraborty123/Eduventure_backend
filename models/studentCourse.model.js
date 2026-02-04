import mongoose from "mongoose";

const studentCourseSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    purchased_at: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      // null means unlimited access
    },
    completedLessons: [
      {
        lesson: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Lesson",
        },
        completed_at: {
          type: Date,
        },
      },
    ],
    completed_at: {
      type: Date,
    },
    recent_access: {
      type: Date,
    },
    certificate: {
      type: String,
    },
    isExpired: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

studentCourseSchema.pre("save", function (next) {
  // Check if course is completed
  if (this.completedLessons.length > 0) {
    const totalLessons = this.completedLessons.length;
    if (totalLessons === this.completedLessons.length) {
      this.isCompleted = true;
      this.completedAt = new Date();
    }
  }

  // Check if course is expired
  if (this.expiresAt && new Date() > this.expiresAt) {
    this.isExpired = true;
  } else {
    this.isExpired = false;
  }

  next();
});

// Add a method to check expiration status
studentCourseSchema.methods.checkExpiration = function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

const StudentCourse = mongoose.model("StudentCourse", studentCourseSchema);
export default StudentCourse;
