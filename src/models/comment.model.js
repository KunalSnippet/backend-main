import mongoose, {Schema} from "mongoose";
import mongooseAgregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema({
  content: {
    type: String,
    required: true
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  video: {
    type: Schema.Types.ObjectId,
    ref: "Video"
  }
}, {timestamps: true});

commentSchema.plugin(mongooseAgregatePaginate);

export const Comment = mongoose.model("comment", commentSchema);