//setup express and router
const express = require('express');
const TransactionModel = require('../models/transaction');
const router = express.Router();
const payableBalanceModel = require('../models/payableBalance');
//setup the route for showing all payable balances in the payableBalance database, it has 3 keys: timestamp, payer, payableBalance. Sorting by timestamp ascending.
router.get('/', async (req, res) => {
	//get all transactions with from the database and sort by timestamp ascending
	const transactions = await TransactionModel.find().sort({ timestamp: 1 });

	for (let i = 0; i < transactions.length; i++) {
		//We don't consider the negative points in the transaction.
		if (transactions[i].points > 0) {
			let payableBalance = transactions[i].points;
			let timestamp = transactions[i].timestamp;
			let payer = transactions[i].payer;
			let used = false;

			//check obj with same payer name and timestamp, or object with 0 payableBalance already in database, if so we do nothing and move on to the next transaction.
			const zeroBalance = await payableBalanceModel.findOne({
				timestamp: timestamp,
				payer: payer,
				payableBalance: 0,
				used: true,
			});
			const sameNameAndTime = await payableBalanceModel.findOne({
				timestamp: timestamp,
				payer: payer,
			});

			if (zeroBalance || sameNameAndTime) {
				continue;
			} else {
				//iterate through the transactions
				for (let j = i + 1; j < transactions.length; j++) {
					// if found same payer with negative points on the same day, deduct the points from the payable balance and save the transaction; If found same payer with positive points, save as individual transaction

					if (
						//same payer with negative points on the same day
						transactions[j].payer === payer &&
						transactions[j].points < 0 &&
						transactions[j].timestamp.getDate() === timestamp.getDate()
					) {
						payableBalance += transactions[j].points;
						if (payableBalance < 0) {
							//save the payableBalance to the database
							const payableBalanceObj = new payableBalanceModel({
								timestamp: timestamp,
								payer: payer,
								payableBalance: 0,
								used: true,
							});

							await payableBalanceObj.save();
						} else {
							//if the points has remaining points, save the transaction.
							const payableBalanceObj = new payableBalanceModel({
								timestamp: timestamp,
								payer: payer,
								payableBalance: payableBalance,
								used: false,
							});
							await payableBalanceObj.save();
						}
					} else if (
						//if same payer in different timestamp with positive points, save as individual transaction
						transactions[j].payer === payer &&
						transactions[j].points > 0 &&
						transactions[j].timestamp.getDate() !== timestamp.getDate()
					) {
						//save as new payableBalance object
						const payableBalanceObj = new payableBalanceModel({
							timestamp: transactions[j].timestamp,
							payer: transactions[j].payer,
							payableBalance: transactions[j].points,
							used: false,
						});
						await payableBalanceObj.save();
					} else {
						//different payer with different timestamp with positive points, save as individual transaction
						const payableBalanceObj = new payableBalanceModel({
							timestamp: transactions[j].timestamp,
							payer: transactions[j].payer,
							payableBalance: transactions[j].points,
							used: false,
						});
						await payableBalanceObj.save();
					}
				}
			}
		}
		//sort the payableBalance database by timestamp ascending
	}
	const sortedPayableBalance = await payableBalanceModel
		.find()
		.sort({ timestamp: 1 });
	//send the payableBalance objects to the client
	res.send(sortedPayableBalance);
});

module.exports = router;
