const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")


const productDetails = async (req,res) =>{
    try{

        const userId = req.session.user;
        const userData = await User.findById(userId)
        const productId = req.query.id
        const product = await Product.findById(productId).populate('category')
        const findCategory = product.category
        const relatedProduct= await Product.find({category:findCategory._id,_id:{$ne:product._id}}).limit(3)

        res.render("product-details",{
            user : userData,
            product : product,
            quantity : product.quantity,
            relatedProduct : relatedProduct
        })

    } catch (error){
      console.error(error)
      res.redirect("/pageNotFound")
    }


}


module.exports = {
    productDetails
}