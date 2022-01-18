//setup express and router
const express = require('express');
const router = express.Router();
const payableBalanceModel = require('../models/payableBalance');
const TransactionModel = require('../models/transaction');
//setup the spend points route，the rules are following:
//1. The route takes 1 parameter which is the total points to spend in the format of {"points":points}
//2. The route returns the payer and the points that the payer spent from the payableBalance database. For example, if the payer has a payableBalance of 100, and the total points to spend is 50, the route returns the payer and -50 points. If the total point to spend is greater than the current payableBalance, the route returns the payer and the negative current payableBalance, and the payableBalance is set to 0.
//3. After the spent from each payer, update the payableBalance database.
//4. The expected response is a json object with the payer and the points spent from the payableBalance database.
//5. Add error handling for the route.
router.post('/', async (req, res) => {
	let spendPoints = [];
	try {
		//get the total points to spend from the request body
		let totalPoints = req.body.points;
		//get all payableBalance objects from the database and sort by timestamp ascending
		let payableBalance = await payableBalanceModel
			.find()
			.sort({ timestamp: 1 });

		//Foreach of the points inside payableBalance model, sum up all of them, if the sum is smaller than the totalPoints, that means we can not afford to spend the totalPoints, so we return total points added from the payableBalance and send back to the client and stop the operation.
		let totalPayableBalance = 0;
		for (let i = 0; i < payableBalance.length; i++) {
			totalPayableBalance += payableBalance[i].payableBalance;
		}
		if (totalPayableBalance < totalPoints) {
			//let the client know that we can not afford to spend the totalPoints
			res.send({
				"sorry,you don't have enough points, your total points is":
					totalPayableBalance,
			});
			//stop the operation
			return;
		} else {
			//while the totalPoints is greater or equal to 0, keep updating each payer's points after deduction. Remember how much points each payer spent from the payableBalance model before the totalPoints reaches 0. We need to return the payer and the points spent as an response after the totalPoints reaches 0. Also we need to update the transaction model after each payer's points spent.

			let i = 0;
			while (i < payableBalance.length) {
				if (payableBalance[i].payableBalance == 0) {
					i++;
					continue;
				}
				//get the payer and the points spent from the payableBalance model
				let payer = payableBalance[i].payer;
				let availablePoints = payableBalance[i].payableBalance;

				//if the availablePoints is greater than the totalPoints, we need to deduct the totalPoints from the availablePoints, and set the availablePoints to 0.

				if (availablePoints >= totalPoints) {
					payableBalance[i].payableBalance = availablePoints - totalPoints;

					//update the payableBalance model with new points left
					await payableBalance[i].save();

					//save the transaction to transaction model
					const transaction = new TransactionModel({
						payer: payer,
						points: -totalPoints,
						timestamp: new Date(),
					});
					await transaction.save();
					//push the payer and the points spent to the spendPoints array.
					spendPoints.push({ payer: payer, points: -totalPoints });

					//since totalPoints is 0, we can stop the loop.
					break;
				} else {
					//if the availablePoints is smaller than the totalPoints, we need to deduct the availablePoints from the totalPoints, and set the availablePoints to 0.
					totalPoints -= availablePoints;
					payableBalance[i].payableBalance = 0;
					//set used property to true
					payableBalance[i].used = true;
					//update the payableBalance model with new points left
					await payableBalance[i].save();

					//save the transaction to transaction model
					const transaction = new TransactionModel({
						payer: payer,
						points: -availablePoints,
						timestamp: new Date(),
					});
					await transaction.save();
					//push the payer and the points spent to the spendPoints array.
					spendPoints.push({ payer: payer, points: -availablePoints });
					//find next payer until the totalPoints is 0.
					i++;
				}
			}
		}
	} catch (error) {
		console.log(error);
	}

	res.send(spendPoints);
});

module.exports = router;
