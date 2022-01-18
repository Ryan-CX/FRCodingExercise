//setup express and router
const express = require('express');
const router = express.Router();
const payableBalanceModel = require('../models/payableBalance');

//setup the balance route. Iterate through the payableBalance model, find the payer with the same name and add their points together. Return a single json object with each payer's name and their total points in the format of {payer1:points1, payer2:points2, ...}.
router.get('/', async (req, res) => {
	//clear the balance object first to avoid duplicate payer and points

	let balance = {};
	try {
		let payableBalance = await payableBalanceModel.find();
		for (let i = 0; i < payableBalance.length; i++) {
			let payer = payableBalance[i].payer;
			let points = payableBalance[i].payableBalance;
			if (balance[payer]) {
				balance[payer] += points;
			} else {
				balance[payer] = points;
			}
		}
	} catch (error) {
		console.log(error);
	}
	res.send(balance);
});

module.exports = router;
