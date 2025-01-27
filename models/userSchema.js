const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({

    name: {
        type : String,
        required : true
    },
    email: {
        type : String,
        required : true,
    },
    phone: {
        type : String,
        required : false,
        sparse : true,
        default : null
    },
    googleId: {
        type : String,
        // unique : true
    },
    password: {
        type : String,
        required : false
    },
    isBlocked: {
        type : Boolean,
        default : false
    },
    isAdmin: {
        type : Boolean,
        default : false
    },
    addresses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address'
    }]
    
 })
 
 
 
 
 const User = mongoose.model("User",userSchema);
 
 
 module.exports = User;
 
