const Coupon = require("../../models/couponSchema")
const mongoose = require("mongoose")

const getCouponPage = async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1;
      const limit = 4; 
      const skip = (page - 1) * limit;

      const totalCoupons = await Coupon.countDocuments({});
      const totalPages = Math.ceil(totalCoupons / limit);

      const findCoupons = await Coupon.find({})
          .skip(skip)
          .limit(limit)
          .sort({ createdOn: -1 }); 

      return res.render("coupon", {
          coupons: findCoupons,
          currentPage: page,
          totalPages: totalPages,
          activeColor: '#088178' 
      });
  } catch (error) {
      console.error(error);
      return res.redirect('/pageError');
  }
};



const createCoupon = async (req, res) => {
  try {
      const validation = await validateCouponData(req.body);
      if (!validation.isValid) {
          return res.status(400).json({ success: false, errors: validation.errors });
      }

      const data = {
          couponName: req.body.couponName,
          startDate: new Date(req.body.startDate + "T00:00:00"),
          endDate: new Date(req.body.endDate + "T00:00:00"),
          offerPrice: parseInt(req.body.offerPrice),
          minimumPrice: parseInt(req.body.minimumPrice)
      };

      // Check for duplicate coupon name
      const existingCoupon = await Coupon.findOne({ name: data.couponName });
      if (existingCoupon) {
          return res.status(400).json({
              success: false,
              errors: { couponName: "Coupon name already exists" }
          });
      }

      const newCoupon = new Coupon({
          name: data.couponName,
          createdOn: data.startDate,
          expireOn: data.endDate,
          offerPrice: data.offerPrice,
          minimumPrice: data.minimumPrice
      });

      await newCoupon.save();
      return res.status(200).json({ success: true, message: "Coupon created successfully" });

  } catch (error) {
      console.error("Coupon creation error:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
  }
};



const getEditCoupon = async (req,res)=>{
    try {
        const id = req.query.id;
        const findCoupon = await Coupon.findOne({_id:id})
        
         res.render("edit-coupon",{findCoupon:findCoupon})
    } catch (error) {
         res.redirect("/pageError")
    }
}

const updateCoupon = async (req, res) => {
  try {
      const validation = await validateCouponData(req.body);
      if (!validation.isValid) {
          return res.status(400).json({ success: false, errors: validation.errors });
      }

      const couponId = req.body.couponId;
      const oid = new mongoose.Types.ObjectId(couponId);

      const existingCoupon = await Coupon.findOne({
          name: req.body.couponName,
          _id: { $ne: oid }
      });
      
      if (existingCoupon) {
          return res.status(400).json({
              success: false,
              errors: { couponName: "Coupon name already exists" }
          });
      }

      const updatedCoupon = await Coupon.findByIdAndUpdate(
          oid,
          {
              $set: {
                  name: req.body.couponName,
                  createdOn: new Date(req.body.startDate),
                  expireOn: new Date(req.body.endDate),
                  offerPrice: parseInt(req.body.offerPrice),
                  minimumPrice: parseInt(req.body.minimumPrice)
              }
          },
          { new: true }
      );

      if (!updatedCoupon) {
          return res.status(404).json({ success: false, message: "Coupon not found" });
      }

      return res.status(200).json({ success: true, message: "Coupon updated successfully" });

  } catch (error) {
      console.error("Coupon update error:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const deleteCoupon = async (req, res) => {
  try {
      const couponId = req.body.id;
      const deletedCoupon = await Coupon.findByIdAndDelete(couponId);
      
      if (!deletedCoupon) {
          return res.status(404).json({ success: false, message: "Coupon not found" });
      }

      return res.status(200).json({ success: true, message: "Coupon deleted successfully" });
  } catch (error) {
      console.error("Coupon deletion error:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
  }
};



const validateCouponData = async (data) => {
  const errors = {};
  const nameRegex = /^[A-Za-z0-9]{1,50}$/;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const offerPrice = parseInt(data.offerPrice);
  const minimumPrice = parseInt(data.minimumPrice);

  const existingCoupon = await Coupon.findOne({ name: data.couponName });
  if (existingCoupon) {
    errors.couponName = "Coupon with this name already exists";
  }

  if (!nameRegex.test(data.couponName)) {
    errors.couponName = "Coupon name must be alphanumeric and between 1-50 characters";
  }

  if (startDate <= today) {
    errors.startDate = "Start date must be after today";
  }

  if (endDate <= startDate) {
    errors.endDate = "End date must be after start date";
  }

  if (isNaN(offerPrice) || isNaN(minimumPrice)) {
    errors.prices = "Both offer price and minimum price must be valid numbers";
  } else if (offerPrice >= minimumPrice) {
    errors.offerPrice = "Offer price must be less than minimum price";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

  



module.exports = {
    getCouponPage,
    createCoupon,
    getEditCoupon,
    updateCoupon,
    deleteCoupon
}