import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
  origin: "CORS_ORIGIN",
  credentials: true
}));
app.use(express.json({
  limit: "10mb"
}));
app.use(express.urlencoded({
  limit: "10mb"
}));
app.use(express.static("public"));
app.use(cookieParser());

//importing routers

import userRouter from "./routes/user.route.js";

app.use("/api/v1/users", userRouter);

export default app;
