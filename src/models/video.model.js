import mongoose, {Schema} from "momngoose";
import mongooseAgregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
     type: String,
    required: true,
  },
  duration: {
    type: Number, // Duration in seconds
    required: true,
  },
  videoFile: {
    type: String,
    required: true,
  },
  thumbnail: {
    type: String,
    required: true,
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  isPublished: {
    type: Boolean,
    default: true,
  },
  views: {
    type: Number,
    default: 0,
  },
}, {timestamps: true});

videoSchema.plugin(mongooseAgregatePaginate);

export const Video = mongoose.model("Video", videoSchema);