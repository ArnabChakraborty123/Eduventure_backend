import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  title: { 
    type: String, 
    trim: true,
    default: ''
  },
  url: { 
    type: String, 
    required: true 
  },
  fileType: { 
    type: String, 
    required: true 
  },
  size: { 
    type: Number,
    required: true
  }
});

const lessonSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: true,
      trim: true
    },
    content: { 
      type: String,
      required: true 
    }, 
    videos: [
      {
        title: { 
          type: String, 
          required: true 
        },
        url: { 
          type: String, 
          required: true 
        },
        duration: { 
          type: Number 
        },
        size: { 
          type: Number
        }
      }
    ],
    documents: [documentSchema],
    chapter: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Chapter",
      required: true 
    },
  },
  { timestamps: true }
);

const Lesson = mongoose.models.Lesson || mongoose.model("Lesson", lessonSchema);

export default Lesson;