const mongoose=require('mongoose')

const walletSchema= new mongoose.Schema({

    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    balance:{
        type:Number,     
        default:0
    },
    transactions: [
        {
            date: {
                type: Date,
                default: Date.now
            },
            type: {
                type: String,
                enum: ['credit', 'debit'],
                default: 'credit'
            },
            amount: {
                type: Number,
                required: true
            }
        }
    ]
})

const Wallet = mongoose.model("Wallet", walletSchema);

module.exports = Wallet;