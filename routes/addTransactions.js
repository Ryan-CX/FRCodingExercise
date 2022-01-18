//setup router and express
const express = require('express');
const router = express.Router();
const TransactionModel = require('../models/transaction');

//Setup add transaction route, including payer, points, and timestamp, save all transactions to mongodb
router.post('/', async (req, res) => {
	const payer = req.body.payer;
	const points = req.body.points;
	const timestamp = req.body.timestamp;
	const transactionInfo = new TransactionModel({
		payer: payer,
		points: points,
		timestamp: timestamp,
	});
	try {
		//if the object already exists, abort the operation
		const transaction = await TransactionModel.findOne({
			payer: payer,
			points: points,
			timestamp: timestamp,
		});
		if (transaction) {
			res.send('Transaction already exists');
		} else {
			console.log(req.body);
			await transactionInfo.save();
			res.send('transaction added');
		}
	} catch (error) {
		console.log(error);
	}
});

module.exports = router;
