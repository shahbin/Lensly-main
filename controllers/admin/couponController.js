const Coupon = require("../../models/couponSchema")
const mongoose = require("mongoose")

const getCouponPage = async(req,res)=>{
    try {
        const findCoupons= await Coupon.find({})

        return res.render("coupon",{coupons:findCoupons})
    } catch (error) {
        return re.redirect('/pageError')
    }
}



const createCoupon = async (req,res)=>{
    try {
        const data = {
            couponName : req.body.couponName,
            startDate : new Date(req.body.startDate + "T00:00:00"),
            endDate : new Date(req.body.endDate + "T00:00:00"),
            offerPrice : parseInt(req.body.offerPrice),
            minimumPrice : parseInt(req.body.minimumPrice)
        }

        const newCoupon = new Coupon({
            name : data.couponName,
            createdOn : data.startDate,
            expireOn : data.endDate,
            offerPrice : data.offerPrice,
            minimumPrice : data.minimumPrice
        })
        await newCoupon.save()
        return res.redirect("/admin/coupon")

    } catch (error) {
        return res.redirect("/pageError")
    }
}



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
      const couponId = req.body.couponId;
      const oid = new mongoose.Types.ObjectId(couponId);
      
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
        return res.status(404).send("Coupon not found");
      }
  
      res.status(200).send("Coupon Updated Successfully");
      
    } catch (error) {
      console.error("Coupon update error:", error);
      res.status(500).send("Error updating coupon: " + error.message);
    }
  };



  const deleteCoupon = async (req, res) => {
    try {
      const id = req.body.id;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Coupon ID is required"
        });
      }
  
      const result = await Coupon.findByIdAndDelete(id);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Coupon not found"
        });
      }
  
      res.status(200).json({
        success: true,
        message: "Coupon deleted successfully"
      });
  
    } catch (error) {
      console.error("Error deleting coupon:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting coupon"
      });
    }
  };
  



module.exports = {
    getCouponPage,
    createCoupon,
    getEditCoupon,
    updateCoupon,
    deleteCoupon
}