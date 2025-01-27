const Brand = require("../../models/brandSchema")
const Product = require("../../models/productSchema")



const getBrandPage = async(req,res)=>{
    try {

        const page = parseInt(req.query.page) || 1
        const limit = 5
        const skip = (page-1)*limit
        const brandData = await Brand.find({}).sort({createdAT:-1}).skip(skip).limit(limit)
        const totalBrands = await Brand.countDocuments()
        const totalPages = Math.ceil(totalBrands/limit)
        const reverseBrand = brandData.reverse()
        res.render("brands",{
            data : reverseBrand,
            currentPage : page,
            totalPages : totalPages,
            totalBrands : totalBrands
        })

    } catch (error) {

        res.redirect("/pageError")
        
    }
}


const addBrand = async (req,res)=>{
    try {
        
        const brand = req.body.name;
        const findBrand = await Brand.findOne({brand});
        if(!findBrand){
            const image = req.file.filename
            const newBrand = new Brand({
                brandName : brand,
                brandImage : image
            })
            await newBrand.save()
            res.redirect("/admin/brands")
        }

    } catch (error) {

        res.redirect("/pageError")
        
    }
}


const blockBrand = async (req,res)=>{
    try {
        
        const brandId = req.query.id;
        const brand = await Brand.findByIdAndUpdate({_id:brandId},{$set:{isBlocked:true}})
        res.redirect("/admin/brands")

    } catch (error) {

        res.redirect("/pageError")
        
    }
}


const unblockBrand = async (req,res)=>{
    try {
        
        const brandId = req.query.id;
        const brand=await Brand.findByIdAndUpdate({_id:brandId},{$set:{isBlocked:false}})
        res.redirect("/admin/brands")

    } catch (error) {

        res.redirect("/pageError")

    }
}


const deleteBrand = async (req,res)=>{
    try {
        
        const {id} = req.query;
        if(!id){
            return res.status(400).redirect("/pageError")
        }
        await Brand.deleteOne({_id:id})
        res.redirect("/admin/brands")

    } catch (error) {

        console.error("Error deleting brand",error);
        res.status(500).redirect("/pageError")

    }
}


module.exports = {
    getBrandPage,
    addBrand,
    blockBrand,
    unblockBrand,
    deleteBrand
}