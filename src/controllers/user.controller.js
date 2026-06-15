import asyncHandler from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js"
import {uploadOnCloud} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async(userId) => {

  try {

  const user = await User.findById(userId);
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({validateBeforeSave: false})

  return {accessToken, refreshToken}

  } catch (error) {
    throw new ApiError(500, "Error while generating tokens");
  }
 
};

const registerUser = asyncHandler( async (req, res) => {
  // console.log(req.body);

  const {fullname, email, username, password } = req.body;
  // console.log("email:", email); 

  if(
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ){
    throw new ApiError(400, "All fields are compulsory to fill");
  };

  const existedUser = await User.findOne({
    $or: [{email}, {username}]
  });

  if(existedUser){
    throw new ApiError(409, "User already exist, you can directly login");
  };

  // console.log(req.files);

  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;

  if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
    coverImageLocalPath = req.files.coverImage[0].path;
  };

  if(!avatarLocalPath){
    throw new ApiError(400, "avatar is required field");
  };

  const avatar = await uploadOnCloud(avatarLocalPath);
  const coverImage = await uploadOnCloud(coverImageLocalPath);

  console.log(avatar);

  if(!avatar){
    throw new ApiError(500, "Avatar not uploaded");
  };

  const user = await User.create({
    username: username.toLowerCase(),
    email,
    password,
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const userCreated = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if(!userCreated){
    throw new ApiError(500, "User is not registered in db");
  };

  return res.status(201).json(
    new ApiResponse(200, userCreated, "User registered successfully")
  );

});

const loginUser = asyncHandler( async (req, res) => {

  /* 
  user exist and check username, email, password if it is there in db
  no data in db then throw error user not exist
  generate access and refresh token
  send secure cookies
  */

  const {username, email, password} = req.body;

  if(!(username || email)){
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{username}, {email}]
  });

  if(!user){
    throw new ApiError(404, "User Not Found");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if(!isPasswordValid){
    throw new ApiError(401, "Password incorrect");
  }

  const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);

  const loggedInUser = await User.findById(user._id).select(" -password -refreshToken" );

  const options = {
    httpOnly: true,
    secure: true
  };

  return res.status(201)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(
    new ApiResponse(
      200,
    {   
      user: loggedInUser, accessToken, refreshToken
    },
    "User loggedIn successfully"
    )
  )
});

const logOutUser = asyncHandler( async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1
      }
    },
    {
      new: true
    }
  )

  const options = {
    httpOnly: true,
    secure: true
  };

  return res.status(201)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(
    new ApiResponse(200, {}, "User loggedOut successfully")
  )
});

const refreshAccessToken = asyncHandler( async (req, res) => {

  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  console.log("incomingRefreshToken:", incomingRefreshToken);

  if(!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    console.log("decodedToken:", decodedToken);

    const user = await User.findById(decodedToken?._id);

    console.log("user:", user);

    if(!user){
      throw new ApiError(400, "Invalid token");
    }

    if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401, "RefreshToken not matched");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);

    const options = {
      httpOnly: true,
      secure: true
    }

    return res.status(201)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
        accessToken,
        refreshToken
      },
        "Access Token Refreshed"
      )
    )

  } catch (error) {
  console.log(error);
  throw new ApiError(401, error?.message || "Token not generated");
}

});

const changePassword = asyncHandler( async (req, res) => {
  const {oldPassword, newPassword} = req.body;

  const user = await User.findById(req.user?._id);

  const validPassword = await user.isPasswordCorrect(oldPassword);

  if(!validPassword){
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({validateBeforeSave: false});

  return res.status(201)
  .json(
    new ApiResponse(
      200,
      {},
      "Password changed successfully"
    )
  );

});

const currentUser = asyncHandler( async (req, res) => {
  const user = await User.findById(req.user?._id);

  return res.status(201).json(
    new ApiResponse(200, user, "Current user fetched")
  );

});

const updateAccountDetails = asyncHandler( async (req, res) => {
  const {fullname, email} = req.body;
  
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname: fullname,
        email: email
      }
    },
    {
      new: true
    }
  ).select("-password -refreshToken");

  return res.status(201).json(
    new ApiResponse(
      200, user, "Details changed successfully"
    )
  );
});

const updateUserAvatar = asyncHandler( async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if(!avatarLocalPath){
    throw new ApiError(400, "Avatar file missing");
  }

  const avatar = await uploadOnCloud(avatarLocalPath);

  if(!avatar){
    throw new ApiError(500, "Something went wrong during uploading the file");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url
      }
    },
    {
      new: true
    }
  ).select("-password -refreshToken");

  return res.status(201).json(
    new ApiResponse(
      200,
      {},
      "avatar updated successfully"
    )
  );

});

const updateUserCoverImage = asyncHandler( async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if(!coverImageLocalPath){
    throw new ApiError(400, "coverImage file missing");
  }

  const coverImage = await uploadOnCloud(coverImageLocalPath);

  if(!coverImage){
    throw new ApiError(500, "Something went wrong during uploading the file");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url
      }
    },
    {
      new: true
    }
  ).select("-password -refershToken");

  return res.status(201).json(
    new ApiResponse(
      200,
      {},
      "coverImage updated successfully"
    )
  );

});

const userSubscribtionDetails = asyncHandler ( async (req, res) => {
  const {username} = req.params;

  if(!username){
    throw new ApiError(400, "Channel not found");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase()
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"
      }
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers"
        },
        channelSubscribedToCount: {
          $size: "$subscribedTo"
        },
        isSubscribed: {
          $cond: {
            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
            then: true,
            else: false
          }
        }
      }
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1
      }
    }
  ]);

  if(!channel.length){
    throw new ApiError(400, "Channel not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      channel[0], 
      "User-Channel details fetched successfully"
    )
  );

});

const getWatchHistory = asyncHandler ( async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              owner: {
                $first: "$owner"
              }
            }
          }
        ]
      }
    }
  ]);

  return res.status(201).json(
    new ApiResponse(
      200,
      user[0].watchHistory,
      "WatchHistory updated successfully"
    )
  )
});
 
export {registerUser,
  loginUser,
  logOutUser,
  refreshAccessToken,
  changePassword,
  currentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  userSubscribtionDetails,
  getWatchHistory
};