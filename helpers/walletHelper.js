const mongoose = require('mongoose');
const Wallet = require('../models/walletSchema');


async function updateWalletBalance(userId, amount, transactionType) {
  try {
      let wallet = await Wallet.findOne({ userId });

      if (!wallet) {
          wallet = new Wallet({
              userId,
              balance: 0,
              transactions: [],
          });
      }
      
      const transactionAmount = Math.abs(amount);
      
      if (transactionType === 'debit') {
          if (wallet.balance >= transactionAmount) {
              wallet.balance -= transactionAmount;
          } else {
              throw new Error('Insufficient balance in wallet');
          }
      } else if (transactionType === 'credit') {
          wallet.balance += transactionAmount;
      } else {
          throw new Error('Invalid transaction type');
      }

      const newTransaction = {
          date: new Date(),
          type: transactionType,
          amount: transactionAmount,
      };

      wallet.transactions.push(newTransaction);

      await wallet.save();
      return { success: true, message: 'Wallet updated successfully' };
  } catch (error) {
      console.error('Wallet update error',error);
      return { success: false, message: error.message };
  }
}




async function updateWalletBalance(userId, amount, transactionType) {
    try {
        let wallet = await Wallet.findOne({ userId });
        
        // Create wallet if it doesn't exist
        if (!wallet) {
            wallet = new Wallet({
                userId,
                balance: 0,
                transactions: [],
            });
        }

        // Ensure amount is positive and properly rounded
        const transactionAmount = Math.round(Math.abs(amount) * 100) / 100;

        if (transactionType === 'debit') {
            // Check if enough balance for debit
            if (wallet.balance < transactionAmount) {
                throw new Error('Insufficient balance in wallet');
            }
            wallet.balance -= transactionAmount;
        } else if (transactionType === 'credit') {
            wallet.balance += transactionAmount;
        } else {
            throw new Error('Invalid transaction type');
        }

        // Add transaction record
        const newTransaction = {
            date: new Date(),
            type: transactionType,
            amount: transactionAmount
        };

        wallet.transactions.push(newTransaction);
        await wallet.save();

        return {
            success: true,
            message: 'Wallet updated successfully',
            transaction: newTransaction
        };
    } catch (error) {
        console.error('Wallet update error:', error);
        throw error;
    }
}



module.exports = {
  updateWalletBalance,
};