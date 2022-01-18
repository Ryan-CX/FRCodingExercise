//setup the express app
const express = require('express');
const app = express();
const DB_CONNECTION =
	'mongodb+srv://xcg:wrn2dyhh@notebook.h028d.mongodb.net/reward?retryWrites=true&w=majority';
const mongoose = require('mongoose');
const TransactionModel = require('./models/transaction');
const payableBalanceModel = require('./models/payableBalance');
app.use(express.json());

//using mongoose to connect to mongodb
mongoose.connect(
	DB_CONNECTION,
	{ useNewUrlParser: true, useUnifiedTopology: true },
	() => {
		console.log('connected to mongoose');
	}
);

//setup the route for showing all transactions in the transactions database
app.get('/', async (req, res) => {
	//get all transactions from the database and sort by timestamp ascending
	const transactions = await TransactionModel.find().sort({ timestamp: 1 });
	//send the transactions to the client
	res.send(transactions);
});

//setup the route for showing all payable balances in the payableBalance database, it has 3 keys: timestamp, payer, payableBalance. Sorting by timestamp ascending.
app.get('/updatePayableBalance', async (req, res) => {
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

//Setup add transaction route, including payer, points, and timestamp, save all transactions to mongodb
app.post('/addTransaction', async (req, res) => {
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

//setup the spend points route，the rules are following:
//1. The route takes 1 parameter which is the total points to spend in the format of {"points":points}
//2. The route returns the payer and the points that the payer spent from the payableBalance database. For example, if the payer has a payableBalance of 100, and the total points to spend is 50, the route returns the payer and -50 points. If the total point to spend is greater than the current payableBalance, the route returns the payer and the negative current payableBalance, and the payableBalance is set to 0.
//3. After the spent from each payer, update the payableBalance database.
//4. The expected response is a json object with the payer and the points spent from the payableBalance database.
//5. Add error handling for the route.
app.post('/spendPoints', async (req, res) => {
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

//setup the balance route. Iterate through the payableBalance model, find the payer with the same name and add their points together. Return a single json object with each payer's name and their total points in the format of {payer1:points1, payer2:points2, ...}.
app.get('/balance', async (req, res) => {
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

//setup the listen port
app.listen(3000, () => {
	console.log(`listening on port 3000`);
});
