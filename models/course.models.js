import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  requirements: [String],
  learningOutcomes: [String],
  thumbnail: {
    type: String, 
  },
  videoPreview: {
    type: String, 
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Instructor',
    required: true
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  
  lesson: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  }],
  chapters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }],

  // New fields for course validity
  validityPeriod: {
    type: {
      type: String,
      enum: ['none', 'days', 'weeks', 'months', 'years'],
      default: 'none'
    },
    duration: {
      type: Number,
      default: 0
    }
  },

  visibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Course = mongoose.model('Course', courseSchema);
export default Course;