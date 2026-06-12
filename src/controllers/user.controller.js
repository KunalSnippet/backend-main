import asyncHandler from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js"
import {uploadOnCloud} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {

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

  res.status(201)
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
      $set: {
        refreshToken: undefined
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

  res.status(201)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(
    new ApiResponse(200, {}, "User loggedOut successfully")
  )
});

const refreshAccessToken = asyncHandler( async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if(!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id);

    if(!user){
      throw new ApiError(400, "Invalid token");
    }

    if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401, "RefreshToken not matched");
    }

    const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id);

    const options = {
      httpOnly: true,
      secure: true
    }

    res.status(201)
    .cookie("accessToken", accessToken, opitons)
    .cookie("refreshToken", newRefreshToken, opitons)
    .json(
      new ApiResponse(
        200,
        {accessToken, newRefreshToken},
        "Access Token Refreshed"
      )
    )

  } catch (error) {
    throw new ApiError(401, "Token not generated")
  }

});
 
export {registerUser, loginUser, logOutUser, refreshAccessToken};