const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema")
const env = require("dotenv").config();
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")
// const shopController = require("./shopController");

const loadHomePage = async (req,res)=>{
    try{
        const user = req.session.user
        const categories = await Category.find({isListed:true})
        const product = await Product.find({isBlocked:false, category:{$in : categories.map(cat => cat._id)}}).populate('category')

        product.sort((a,b)=> new Date(b.createdOn)-new Date(a.createdOn))
        
        
        if(user){
            const userData = await User.findById({_id:user})
            
            return res.render("home",{user:userData, products:product})
        }else{
            return res.render('home',{user: null, products:product})
        }
    }
    catch(error){
        console.log("Home page not found");
        res.status(500).send("Server error")
    }
}


const pageNotFound = async (req,res) => {
    try{

        res.render("page-404")
    }
    catch(error){
        res.redirect('/pageNotFound')
    }
}

const loadShopPage = async (req, res) => {
  const selectedCategory = req.query.category ? req.query.category.split(',') : [];
  const selectedSort = req.query.sort || '';
  const minPrice = req.query.minPrice || 0;
  const maxPrice = req.query.maxPrice || 500000;

  try {
    const userId = req.session.user;
    const page = parseInt(req.query.page) || 1;
    let limit = 8;
    const skip = (page - 1) * limit;

    let query = {
      isBlocked: false,
      salePrice: { $gte: parseInt(minPrice), $lte: parseInt(maxPrice) }
    };

    if (selectedCategory.length > 0) {
      const categories = await Category.find({ name: { $in: selectedCategory } });
      query.category = { $in: categories.map(cat => cat._id) };
    }

    let sort = {};
    if (selectedSort) {
      if (selectedSort === 'priceLowToHigh') {
        sort.salePrice = 1;
      } else if (selectedSort === 'priceHighToLow') {
        sort.salePrice = -1;
      } else if (selectedSort === 'popularity') {
        sort.orders = -1; // Assuming 'orders' field tracks the number of orders
        limit = 6; // Limit to 6 products
      } else if (selectedSort === 'featured') {
        const categories = await Category.find({});
        const featuredProducts = [];
        for (const category of categories) {
          const product = await Product.findOne({ category: category._id, isBlocked: false })
            .sort({ orders: -1 })
            .exec();
          if (product) {
            featuredProducts.push(product);
          }
        }
        return res.render('shop', {
          user: userId ? await User.findById(userId) : null,
          products: featuredProducts,
          pagination: { currentPage: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
          selectedCategory,
          selectedSort,
          minPrice,
          maxPrice,
          categoryQuantities: await getCategoryQuantities(),
          totalProducts: featuredProducts.length
        });
      } else if (selectedSort === 'newArrivals') {
        sort.createdOn = -1;
        limit = 4; // Limit to 4 products
      } else if (selectedSort === 'aToZ') {
        sort.productName = 1;
      } else if (selectedSort === 'zToA') {
        sort.productName = -1;
      }
    }

    const totalProducts = await Product.countDocuments(query);

    const product = await Product.find(query)
      .populate('category')
      .collation({ locale: 'en', strength: 2 }) // Case-sensitive collation
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalProducts / limit);

    const categoryQuantities = await Product.aggregate([
      { $match: { isBlocked: false } },
      { $group: { _id: "$category", totalQuantity: { $sum: "$quantity" } } }
    ]);

    const categoryQuantitiesMap = {};
    for (const item of categoryQuantities) {
      const category = await Category.findById(item._id);
      if (category) {
        categoryQuantitiesMap[category.name] = item.totalQuantity;
      }
    }

    const pagination = {
      currentPage: page,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
    };

    if (userId) {
      const userData = await User.findById({ _id: userId });

      return res.render("shop", {
        user: userData,
        products: product,
        pagination: pagination,
        selectedCategory,
        selectedSort,
        minPrice,
        maxPrice,
        categoryQuantities: categoryQuantitiesMap,
        totalProducts
      });
    } else {
      return res.render('shop', {
        products: product,
        pagination: pagination,
        selectedCategory,
        selectedSort,
        minPrice,
        maxPrice,
        categoryQuantities: categoryQuantitiesMap,
        totalProducts
      });
    }
  } catch (error) {
    console.log('Shop page not loading', error);
    res.status(500).send('Server Error');
  }
};

async function getCategoryQuantities() {
  const categoryQuantities = await Product.aggregate([
    { $match: { isBlocked: false } },
    { $group: { _id: "$category", totalQuantity: { $sum: "$quantity" } } }
  ]);

  const categoryQuantitiesMap = {};
  for (const item of categoryQuantities) {
    const category = await Category.findById(item._id);
    if (category) {
      categoryQuantitiesMap[category.name] = item.totalQuantity;
    }
  }
  return categoryQuantitiesMap;
}

const loadSignup = async (req,res)=>{
    try{
        return res.render('signup')
    }
    catch(error){
        console.log('Signup page not loading');
        res.status(500).send('Server Error')
    }
}


function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString()

}

async function sendVerificationEmail(email,otp){

    console.log(email, otp)
    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port:587,
            secure:false,
            auth:{
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }

        })
        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject:"Verify your account",
            text:`Your OTP is ${otp}`,
            html:`<br> Your OTP: ${otp} <br>`
        })

        return info.accepted.length > 0

    } catch (error) {
        console.error("Error sending email",error);
        return false

    }
}

const signup = async (req,res)=>{
    try {
        const {name, email, phone, password, cPassword} = req.body;

        const findUser = await User.findOne({email})
        if(findUser){
            return res.render('signup',{message:"User with this email already exists"})
        }

       if(password !== cPassword){
        return res.render('signup',{message:"Passwords do not match"})
       } 

       const otp = generateOtp()
       const emailSend = await sendVerificationEmail(email,otp)

       if(!emailSend){
        return res.json("email-error")
       }

       req.session.userOtp = otp;
       req.session.userData = {name, email, phone, password};

       res.render("verify-otp")
       console.log("otp send",otp);
       
    } catch (error) {
        console.error("Signup error",error);
        res.redirect('/pageNotFound')
        
    }
}

const securePassword = async (password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10)
        return passwordHash
    } catch (error) {
        
    }
}

const verifyOtp = async (req,res)=>{
    try {
        const {otp} = req.body;

        if(otp === req.session.userOtp){
            const user = req.session.userData
            

            const passwordHash = await securePassword(user.password)

            const saveUserData = new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash
            })

            await saveUserData.save()
            req.session.user = saveUserData._id
            res.json({success:true, redirectUrl:"login"})
        }else{
            res.status(400).json({success:false, message:"Invalid OTP, Please try again"})
        }
        
    } catch (error) {

        console.error("Error Verifying OTP",error);
        res.status(500).json({success:false, message:"An error happen"})
    }
}


const resendOtp = async (req,res)=>{
    try {

        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }

        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSend = await sendVerificationEmail(email,otp);
        if(emailSend){
            console.log("Resend OTP",otp);
            res.status(200).json({success:true,message:"OTP Resend Successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to send Resend otp, Please try again"})
        }
        
    } catch (error) {
        console.error("Error resending OTP",error);
        res.status(500).json({success:false,message:"Internal Server Error, Please try again"})
        
    }
}


const loadLogin = async (req,res)=>{
    try{
        const user = req.session.user;
        if (!user) {
            return res.render('login', { user: null });
        } else {
            const userData = await User.findById({ _id: user });
            return res.render('login', { user: userData });
        }
    }
    catch(error){
        res.redirect('pageNotFound')
    }
}



const login = async (req,res)=>{
    try {
        const {email,password} = req.body;
        const findUser = await User.findOne({isAdmin:false,email:email})

        if(!findUser){
            return res.render("login",{message:"User not found"})
        }
        if(findUser.isBlocked){
            return res.render("login",{message:"User is blocked by admin"})
        }

        const passwordMatch = await bcrypt.compare(password,findUser.password)

        if(!passwordMatch){
            return res.render("login",{message:"Incorrect Password"})
        }
        
        req.session.user = findUser._id;
        res.redirect("/login")
        
    } catch (error) {
        console.error(error);
        res.render("login",{message:"Please try again later"})
    }
}




const logout = async (req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error", err.message);
                return res.redirect('/pageNotFound')
            }
            return res.redirect("login")
        })
    } catch (error) {
        console.log("Logout error", error);
        res.redirect("/pageNotFound")
    }
}

const searchProducts = async (req, res) => {
    try {
      const query = req.query.query || '';

      if (query.trim() === '') {
        return res.redirect('/');
      }
  
      const products = await Product.find({
        productName: { $regex: query, $options: 'i' },
        isBlocked: false
      });
  
      res.render('search-results', {
        user: req.session.user,
        products,
        query
      });
    } catch (error) {
      console.error('Error searching products:', error);
      res.redirect('/pageNotFound');
    }
  };


  

module.exports = {
    loadHomePage,
    pageNotFound,
    loadSignup,
    loadShopPage,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    searchProducts
}