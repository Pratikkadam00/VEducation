import mongoose, { Document, Schema, Model } from "mongoose";

//replies comments
interface IComment extends Document {
  user: object;
  comment: string;
}

// user comment
interface IReview extends Document {
  user: object;
  rating: number;
  comment: string;
  commentReplies: IComment[];
}

//Link interface
interface ILink extends Document {
  title: string;
  url: string;
}

//interface for course
interface ICourseData extends Document {
  title: string;
  description: string;
  videoUrl: string;
  videoThumbnail: object;
  videoSection: string;
  videoLength: number;
  videoPlayer: string;
  suggestion: string;
  links: ILink[];
  questions: IComment[];
}

//interface for course which is main thing here
interface ICourse extends Document {
  name: string;
  description: string;
  price: number;
  estimatedPrice?: number;
  thumbnail: object;
  tags: string;
  level: string;
  demoUrl: string;
  benefits: { title: string }[];
  prerequisites: { title: string }[];
  reviews: IReview[];
  courseData: ICourseData[];
  ratings?: number;
  purchased?: number;
}
