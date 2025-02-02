const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema")
const Wallet = require("../../models/walletSchema")
const Wishlist = require("../../models/wishlistSchema")
const Cart = require("../../models/cartSchema")
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")

const userProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId);
    const cart = await Cart.findOne({ userId });
    res.locals.cartItems = cart ? cart.items : [];
    res.locals.cartCount = cart ? cart.items.length : 0;
    const wishlistItems = await Wishlist.findOne({ userId });
    if (!user) {
      return res.redirect("/login");
    }

    const userData = `
            <script>
                const currentUserData = {
                    name: "${user.name}",
                    phone: "${user.phone}"
                };
            </script>
        `;

    res.render("user-profile", {
      user,
      userData,
      cartItems: res.locals.cartItems,
      wishlistItems: wishlistItems.products 
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.redirect("/login");
  }
};

const editProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const { name, email, phone } = req.body;

    const user = await User.findByIdAndUpdate(userId, { name, email, phone }, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
}

const changePassword = async (req, res) => {
  try {
    const userId = req.session.user;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New passwords do not match' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: 'Failed to change password', error: error.message });
  }
}



const getAddresses = async (req, res) => {
    try {
        
        const userId = req.session.user;
        const userAddress = await Address.findOne({ userId });

        if (!userAddress) {
            return res.status(200).json({
                success: true,
                addresses: []
            });
        }

        return res.status(200).json({
            success: true,
            addresses: userAddress.addresses.map(address => ({
                _id: address._id,
                addressType: address.addressType, 
                name: address.name,
                phone: address.phone,
                altPhone: address.altPhone,
                city: address.city,
                landMark: address.landMark, 
                state: address.state,
                pincode: address.pincode,
                createdAt: address.createdAt
            }))
        });

    } catch (error) {
        console.error('Error fetching addresses:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.'
        });
    }
};


const addAddress = async (req, res) => {
    try {
        const validateInput = (data) => {
            const errors = [];
            const phoneRegex = /^\d{10}$/;
            const pincodeRegex = /^[1-9][0-9]{5}$/;
            const alphaRegex = /^[a-zA-Z\s]+$/;
            const validAddressTypes = ['home', 'work', 'other'];
            const invalidPhonePattern = /0{7,}/; 

            const {
                addressType,
                name = '',
                phone = '',
                altPhone = '',
                city = '',
                landMark = '',
                state = '',
                pincode = ''
            } = data;

            if (!addressType || !validAddressTypes.includes(addressType.toLowerCase())) {
                errors.push('Please select a valid address type (home, work, or other)');
            }

            if (!name || name.trim().length <= 3) {
                errors.push('Name must be more than 3 characters');
            } else if (!alphaRegex.test(name.trim())) {
                errors.push('Name must contain only letters and spaces');
            }

            if (!phone) {
                errors.push('Phone number is required');
            } else if (!phoneRegex.test(phone) || invalidPhonePattern.test(phone)) {
                errors.push('Phone number must be exactly 10 digits and cannot contain 7 or more consecutive zeros');
            }

            if (!city || !alphaRegex.test(city.trim())) {
                errors.push('City must contain only letters and spaces');
            }

            if (!state || !alphaRegex.test(state.trim())) {
                errors.push('State must contain only letters and spaces');
            }

            if (!pincode) {
                errors.push('Pincode is required');
            } else if (!pincodeRegex.test(pincode)) {
                errors.push('Pincode must be a valid 6-digit number not starting with 0');
            }

            if (altPhone && (!phoneRegex.test(altPhone) || invalidPhonePattern.test(altPhone))) {
                errors.push('Alternative phone number must be exactly 10 digits and cannot contain 7 or more consecutive zeros');
            }

            if (landMark && landMark.trim().length > 100) {
                errors.push('Landmark must not exceed 100 characters');
            }

            return errors;
        };

        const validationErrors = validateInput(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }

        const addressData = {
            addressType: req.body.addressType.toLowerCase().trim(),
            name: req.body.name.replace(/[^a-zA-Z\s]/g, '').trim(),
            phone: req.body.phone,
            altPhone: req.body.altPhone || '',
            city: req.body.city.trim(),
            landMark: (req.body.landMark || '').trim(),
            state: req.body.state.trim(),
            pincode: req.body.pincode,
            createdAt: new Date()
        };

        const userId = req.session.user;
        let userAddress = await Address.findOne({ userId });

        const MAX_ADDRESSES = 5; 
        if (userAddress && userAddress.addresses.length >= MAX_ADDRESSES) {
            return res.status(400).json({
                success: false,
                message: `Maximum limit of ${MAX_ADDRESSES} addresses reached. Please delete an existing address to add a new one.`
            });
        }

        if (userAddress) {
            const isDuplicate = userAddress.addresses.some(addr => 
                addr.phone === addressData.phone &&
                addr.pincode === addressData.pincode &&
                addr.city.toLowerCase() === addressData.city.toLowerCase()
            );

            if (isDuplicate) {
                return res.status(400).json({
                    success: false,
                    message: 'This address already exists'
                });
            }

            userAddress.addresses.push(addressData);
            await userAddress.save();
        } else {
            userAddress = new Address({
                userId,
                addresses: [addressData]
            });
            await userAddress.save();
        }

        return res.status(201).json({
            success: true,
            message: 'Address added successfully',
            address: {
                ...addressData,
                _id: userAddress.addresses[userAddress.addresses.length - 1]._id
            }
        });

    } catch (error) {

        console.error('Address addition error:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid input data',
                errors: Object.values(error.errors).map(err => err.message)
            });
        }

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate address entry'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.'
        });
    }
};


const editAddress = async (req, res) => {
    try {
        
        const { id: addressId } = req.params; 
        const userId = req.session.user;

        const validateInput = (data) => {
            const errors = [];
            const phoneRegex = /^\d{10}$/;
            const pincodeRegex = /^[1-9][0-9]{5}$/;
            const alphaRegex = /^[a-zA-Z\s]+$/;
            const validAddressTypes = ['home', 'work', 'other'];
            const invalidPhonePattern = /0{7,}/; 

            const {
                addressType,
                name = '',
                phone = '',
                altPhone = '',
                city = '',
                landMark = '',
                state = '',
                pincode = ''
            } = data;

            if (!addressType || !validAddressTypes.includes(addressType.toLowerCase())) {
                errors.push('Please select a valid address type (home, work, or other)');
            }

            if (!name || name.trim().length <= 3) {
                errors.push('Name must be more than 3 characters');
            } else if (!alphaRegex.test(name.trim())) {
                errors.push('Name must contain only letters and spaces');
            }

            if (!phone) {
                errors.push('Phone number is required');
            } else if (!phoneRegex.test(phone) || invalidPhonePattern.test(phone)) {
                errors.push('Phone number must be exactly 10 digits and cannot contain 7 or more consecutive zeros');
            }

            if (!city || !alphaRegex.test(city.trim())) {
                errors.push('City must contain only letters and spaces');
            }

            if (!state || !alphaRegex.test(state.trim())) {
                errors.push('State must contain only letters and spaces');
            }

            if (!pincode) {
                errors.push('Pincode is required');
            } else if (!pincodeRegex.test(pincode)) {
                errors.push('Pincode must be a valid 6-digit number not starting with 0');
            }

            if (altPhone && (!phoneRegex.test(altPhone) || invalidPhonePattern.test(altPhone))) {
                errors.push('Alternative phone number must be exactly 10 digits and cannot contain 7 or more consecutive zeros');
            }

            return errors;
        };

        const validationErrors = validateInput(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }

        const addressDoc = await Address.findOne({ userId });
        
        if (!addressDoc) {
            return res.status(404).json({
                success: false,
                message: 'No addresses found for this user'
            });
        }

        const addressIndex = addressDoc.addresses.findIndex(
            addr => addr._id.toString() === addressId
        );

        if (addressIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        const updatedAddress = {
            addressType: req.body.addressType.toLowerCase().trim(),
            name: req.body.name.replace(/[^a-zA-Z\s]/g, '').trim(),
            phone: req.body.phone,
            altPhone: req.body.altPhone || '',
            city: req.body.city.trim(),
            landMark: (req.body.landMark || '').trim(),
            state: req.body.state.trim(),
            pincode: req.body.pincode,
            updatedAt: new Date()
        };

        const isDuplicate = addressDoc.addresses.some((addr, index) => 
            index !== addressIndex && 
            addr.phone === updatedAddress.phone &&
            addr.pincode === updatedAddress.pincode &&
            addr.city.toLowerCase() === updatedAddress.city.toLowerCase()
        );

        if (isDuplicate) {
            return res.status(400).json({
                success: false,
                message: 'This address already exists'
            });
        }

        addressDoc.addresses[addressIndex] = {
            _id: addressDoc.addresses[addressIndex]._id,
            ...updatedAddress
        };

        await addressDoc.save();

        return res.status(200).json({
            success: true,
            message: 'Address updated successfully',
            address: addressDoc.addresses[addressIndex]
        });

    } catch (error) {
        console.error('Error updating address:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid input data',
                errors: Object.values(error.errors).map(err => err.message)
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.'
        });
    }
};


const deleteAddress = async (req, res) => {
    try {
        const { id: addressId } = req.params; 
        const userId = req.session.user;

        const addressDoc = await Address.findOne({ userId });

        if (!addressDoc) {
            return res.status(404).json({
                success: false,
                message: 'No addresses found for this user'
            });
        }

        const addressIndex = addressDoc.addresses.findIndex(
            addr => addr._id.toString() === addressId
        );

        if (addressIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        addressDoc.addresses.splice(addressIndex, 1);

        await addressDoc.save();

        return res.status(200).json({
            success: true,
            message: 'Address deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting address:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.'
        });
    }
};

const forgotPassword = async(req, res) => {
    try {
        res.render('forgot-password')
    } catch (error) {
        console.error("Error in forgotPassword:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


async function sendVerificationEmail(email, otp) {
    console.log(email, otp);
    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });
        
        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<br> Your OTP: ${otp} <br>`
        });

        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}

const forgotEmailValid = async(req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });

        console.log(findUser);

        if (findUser) {
            const otp = generateOtp();
            const sendMail = await sendVerificationEmail(email, otp);

            if (sendMail) {
                req.session.userOtp = otp;
                req.session.email = email;

                res.render("forgot-otp");
                console.log("Forget Pass OTP:", otp);
            } else {
                res.json({ success: false, message: "Failed to send OTP, Please try again!" });
            }
        } else {
            res.render("forgot-password", { message: "Entered Email does not exist" });
        }
    } catch (error) {
        console.error("Error in forgotEmailValid:", error);
        res.redirect("/login");
    }
}

const verifyEmailOtp = async (req, res) => {
  try {
      const { otp } = req.body;
      
      if (!otp || !req.session.userOtp) {
          return res.status(400).json({ 
              success: false, 
              message: "OTP is required or session expired" 
          });
      }

      if (otp === req.session.userOtp) {
    
          req.session.isOtpVerified = true;
          
          console.log("Email in session during OTP verify:", req.session.email);
          res.json({ success: true, redirectUrl: '/create-password' });
      } else {
          res.json({ success: false, message: "OTP does not match" });
      }
  } catch (error) {
      console.error("Error in verifyEmailOtp:", error);
      res.status(500).json({ success: false, message: "An error occurred" });
  }
}

const resendEmailOtp = async (req, res) => {
    try {
        const email = req.session.email;  
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: "Email not found in session" 
            });
        }

        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSend = await sendVerificationEmail(email, otp);
        if (emailSend) {
            console.log("Resend OTP:", otp);
            res.status(200).json({ 
                success: true, 
                message: "OTP Resent Successfully" 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: "Failed to resend OTP, Please try again" 
            });
        }
    } catch (error) {
        console.error("Error resending OTP:", error);
        res.status(500).json({ 
            success: false, 
            message: "Internal Server Error, Please try again" 
        });
    }
}


const createPassword = async(req,res) => {
    try {

      console.log("Entering createPassword controller");
      console.log("Session data:", {
          email: req.session.email,
          isOtpVerified: req.session.isOtpVerified
      });

      if (!req.session.email || !req.session.isOtpVerified) {
          return res.redirect('/login');
      }
       
        res.render('new-password');
    } catch (error) {
        console.error("Error in createPassword:", error);
        res.redirect("/pageNotFound");
    }
}

const saveNewPassword = async(req, res) => {
  try {
      console.log("Entering saveNewPassword controller");
      
      const {newPassword, confirmPassword} = req.body;
      const email = req.session.email;

      if(!email || !req.session.isOtpVerified) {
          console.log("Invalid session state");
          return res.json({
              success: false,
              message: "Session expired. Please try again."
          });
      }

      if(newPassword !== confirmPassword) {
          return res.json({
              success: false,
              message: "Passwords do not match"
          });
      }

      try {
          const passwordHash = await securePassword(newPassword);
          const updated = await User.updateOne(
              {email: email},
              {$set: {password: passwordHash}}
          );
          
          console.log("Password update result:", updated);
          
          if (updated.modifiedCount === 0) {
              throw new Error('Password update failed');
          }
          
          await new Promise((resolve, reject) => {
              req.session.destroy((err) => {
                  if(err) reject(err);
                  else resolve();
              });
          });
          return res.redirect('/login')

      } catch (dbError) {
          console.error("Database error:", dbError);
          return res.json({
              success: false,
              message: "Failed to update password. Please try again."
          });
      }
      
  } catch (error) {
      console.error("Error in saveNewPassword:", error);
      return res.json({
          success: false,
          message: "An unexpected error occurred. Please try again."
      });
  }
}


const securePassword = async(newPassword)=>{
    try {
        const passwordHash = await bcrypt.hash(newPassword,10);
        return passwordHash
    } catch (error) {
        
    }
}


const getWalletPage = async(req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        const wallet = await Wallet.findOne({ userId });
        const cart = await Cart.findOne({ userId });
        res.locals.cartItems = cart ? cart.items : [];
        res.locals.cartCount = cart ? cart.items.length : 0;
        const wishlistItems = await Wishlist.findOne({ userId:userId });

        if (!wallet) {
            wallet = { balance: 0, transactions: [] };
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const totalTransactions = wallet.transactions.length;
        const totalPage = Math.ceil(totalTransactions / limit);

        wallet.transactions = wallet.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice((page - 1) * limit, page * limit);

        res.render('wallet', {
            user,
            wallet,
            currentPage: page,
            totalPage,
            wishlistItems: wishlistItems.products,
            cartItems: res.locals.cartItems
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "server error" });
    }
};


module.exports = {
  userProfile,
  editProfile,
  changePassword,
  getAddresses,
  addAddress,
  editAddress,
  deleteAddress, 
  forgotPassword,
  securePassword, 
  forgotEmailValid,
  verifyEmailOtp,
  resendEmailOtp,
  createPassword,
  saveNewPassword,
  getWalletPage
};
