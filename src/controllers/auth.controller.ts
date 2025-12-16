import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { ApiResponse } from "src/utils/api-response";
import {
  getUserByColumn,
  createUser,
  getUserById,
  updateUserRefreshToken,
  getUserByEmail,
  updateUserByColumn,
} from "src/utils/users";
import { ApiError } from "src/utils/api-error";
import {
  generateRefreshToken,
  generateAccessToken,
  generateTemporaryToken,
} from "src/utils/jwtoken";
import { emailVerificationMailgenContent, sendEmail } from "src/utils/mail";
import { comparePassword, hashPassword } from "src/utils/password";

export const healthCheck = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, { message: "Server is running" }));
});

const generateAccessAndRefreshTokens = async (userId: string) => {
  try {
    const user = await getUserById(userId);
    const accessToken = generateAccessToken(userId, user.email, user.username);
    const refreshToken = generateRefreshToken(userId);

    updateUserRefreshToken(userId, refreshToken);
    return { accessToken, refreshToken };
  } catch (error) {}
  throw new ApiError(
    500,
    "Something went wrong while generating access token ",
    [],
  );
};
const register = asyncHandler(async (req: Request, res: Response) => {
  // ✅ 1. Request geldi mi?
  console.log('🔵 ========== REGISTER BAŞLADI ==========');
  console.log('📥 Request body:', JSON.stringify(req.body, null, 2));
  
  const { email, username, password, role } = req.body;
  
  console.log('📝 Extracted data:', { email, username, role, passwordLength: password?.length });

  // ✅ 2. User var mı kontrol
  console.log('🔍 Checking if user exists with email:', email);
  const existedUser = await getUserByColumn("email", email);
  
  console.log('🔍 User check result:', existedUser ? '❌ User EXISTS' : '✅ User NOT FOUND (Good)');

  if (existedUser) {
    console.log('❌ Throwing 409 - User already exists');
    throw new ApiError(409, "existed user", []);
  }
  
  console.log('✅ User does not exist, proceeding...');
  const hashedPassword = await hashPassword(password);
  // ✅ 3. User data hazırlama
  const userData = {
    email: email,
    username: username,
    password: hashedPassword,
    role: role,
  };
  


  // ✅ 4. User oluşturma
  console.log('💾 Creating user in database...');
  const user = await createUser(userData);
  
  console.log('✅ User created successfully!');
  console.log('👤 Created user:', { 
    id: user.id, 
    email: user.email, 
    username: user.username 
  });

  // ✅ 5. Token oluşturma
  console.log('🔐 Generating verification token...');
  const { unHashedToken, hashedToken, tokenExpiry } = generateTemporaryToken();
  
  console.log('🔐 Token generated:', {
    unHashedTokenLength: unHashedToken?.length,
    hashedTokenLength: hashedToken?.length,
    tokenExpiry: tokenExpiry,
    tokenExpiryType: typeof tokenExpiry,
  });

  // ✅ 6. Hashed data hazırlama
  const hashedData = {
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: tokenExpiry,
  };
  
  console.log('📝 Hashed data to update:', {
    hashedTokenLength: hashedData.emailVerificationToken?.length,
    expiry: hashedData.emailVerificationExpiry,
    expiryType: typeof hashedData.emailVerificationExpiry,
    
  });

  // ✅ 7. User update
  console.log('💾 Updating user with verification token...');
  console.log('💾 User ID to update:', user.id);
  
  await updateUserByColumn(hashedData, user.id);
  
  console.log('✅ User updated with verification token');

  // ✅ 8. Email gönderme
  console.log('📧 Preparing to send email...');
  
  const verificationUrl = `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`;
  
  console.log('📧 Verification URL:', verificationUrl);
  console.log('📧 Sending to:', user.email);
  console.log('📧 Username:', user.username);
  
  await sendEmail({
    email: user.email,
    subject: "Please verify your email",
    mailgenContent: emailVerificationMailgenContent(
      user.username,
      verificationUrl
    ),
  });
  
  console.log('✅ Email sent successfully!');

  // ✅ 9. Response
  console.log('📤 Sending success response...');
  
  res
    .status(201)
    .json(new ApiResponse(201, { 
      message: "User registered successfully",
      data: user.username 
    }));
  
  console.log('🟢 ========== REGISTER BAŞARILI ==========');
});


const login =  asyncHandler(async (req: Request, res: Response) => { 

  const {email,password,username} = req.body;
  if (!email) {
    throw new ApiError(400, " email is required");
  }
  const user = await getUserByEmail(email);
  
  if (!user) {
    throw new ApiError(400, "User does not exists");
  }

 const isValid = await comparePassword(password, user.password);
console.log(isValid)

  if (!isValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user.id,
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: username,
          accessToken,
          refreshToken,
        },
        "User logged in successfully",
      ),
    );


});

export{register,login};