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
    }],
    referralCode: {
        type: String,
        unique: true,
    },
    referralCount: {
        type: Number,
        default: 0
    },
    walletBalance: {
        type: Number,
        default: 0
    },
    hasAppliedReferral: {
        type: Boolean,
        default: false
    }
    
 })


 function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 8 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

// Pre-save hook to generate referral code for new users
userSchema.pre('save', async function (next) {
    if (!this.referralCode) {
        let uniqueCode;
        do {
            uniqueCode = generateReferralCode();
        } while (await mongoose.model("User").exists({ referralCode: uniqueCode }));
        this.referralCode = uniqueCode;
    }
    next();
});

userSchema.statics.generateMissingReferralCodes = async function () {
    const users = await this.find({ referralCode: { $exists: false } });
    
    for (const user of users) {
        let uniqueCode;
        do {
            uniqueCode = generateReferralCode();
        } while (await this.exists({ referralCode: uniqueCode }));

        user.referralCode = uniqueCode;
        await user.save();
        
        console.log(`Assigned referral code ${uniqueCode} to user ${user._id}`);
    }
};

 
 
 const User = mongoose.model("User",userSchema);
 
 
 module.exports = User;
 
