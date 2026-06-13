import { Router } from "express";
import { registerUser, loginUser, logOutUser, refreshAccessToken, changePassword,
  currentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  userSubscribtionDetails,
  getWatchHistory } from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1
    },
    {
      name: "coverImage",
      maxCount: 1
    }
  ]),
  registerUser);

router.route("/login").post(loginUser);

//secured route

router.route("/logout").post(verifyJWT,logOutUser);
router.route("/refresh-token").post(refreshAccessToken);

router.route("/change-password").post(verifyJWT, changePassword);
router.route("/current-user").post(verifyJWT, currentUser);

router.route("/update-profile").patch(verifyJWT, updateAccountDetails);
router.route("/change-avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar);
router.route("/change-coverImage").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage);

router.route("/c/:username").get(verifyJWT, userSubscribtionDetails);

router.route("/history").get(verifyJWT, getWatchHistory);
export default router;