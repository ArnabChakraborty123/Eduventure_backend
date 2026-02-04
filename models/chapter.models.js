import mongoose from 'mongoose';

const chapterSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    lessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }]
  },
  { timestamps: true }
);

const Chapter = mongoose.model('Chapter', chapterSchema);

export default Chapter;
