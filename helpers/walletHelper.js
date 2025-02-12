const mongoose = require('mongoose');
const Wallet = require('../models/walletSchema');


async function updateWalletBalance(userId, amount, transactionType) {
  try {
      console.log(userId, amount, transactionType, 'userid')
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

      const walletcreated = await wallet.save();
      console.log(walletcreated, 'create wallet')
      return { success: true, message: 'Wallet updated successfully' };
  } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
  }
}


module.exports = {
  updateWalletBalance,
};