const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    addresses: [ // Changed to "addresses" for consistency
        {
            addressType: {
                type: String,
                required: true, // Added required constraint
                enum: ["home", "work", "other"], // Valid address types
            },
            name: {
                type: String,
                required: true, // Added required constraint
                minlength: 3, // Ensures name is at least 3 characters
            },
            city: {
                type: String,
                required: true, // Added required constraint
            },
            landMark: {
                type: String,
                maxlength: 100, // Restrict to 100 characters
            },
            state: {
                type: String,
                required: true, // Added required constraint
            },
            pincode: {
                type: String, // Changed to String for flexibility
                required: true, // Added required constraint
                match: /^[1-9][0-9]{5}$/, // Regex for Indian pincodes
            },
            phone: {
                type: String,
                required: true, // Added required constraint
                match: /^\d{10}$/, // Regex for 10-digit phone numbers
            },
            altPhone: {
                type: String,
                match: /^\d{10}$/, // Optional, but must match 10 digits
            },
            createdAt: {
                type: Date,
                default: Date.now, // Added to track creation time
            },
        },
    ],
});

const Address = mongoose.model("Address", addressSchema);

module.exports = Address;
