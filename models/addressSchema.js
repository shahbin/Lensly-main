const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    addresses: [ 
        {
            addressType: {
                type: String,
                required: true, 
                enum: ["home", "work", "other"],
            },
            name: {
                type: String,
                required: true, 
                minlength: 3, 
            },
            city: {
                type: String,
                required: true, 
            },
            landMark: {
                type: String,
                maxlength: 100, 
            },
            state: {
                type: String,
                required: true, 
            },
            pincode: {
                type: String, 
                required: true, 
                match: /^[1-9][0-9]{5}$/, 
            },
            phone: {
                type: String,
                required: true,
                match: /^\d{10}$/, 
            },
            altPhone: {
                type: String,
                match: /^\d{10}$/, 
            },
            createdAt: {
                type: Date,
                default: Date.now, 
            },
        },
    ],
});

const Address = mongoose.model("Address", addressSchema);

module.exports = Address;
