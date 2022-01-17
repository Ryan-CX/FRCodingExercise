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

//update the payableBalance database with the following rules:
//1.The object is sorted by timestamp ascending
//2.iterate the array of transactions,initial a minimum value for each payer,find the minimum points that a payer can get by adding all the transactions that are greater than the current timestamp, and subtract the points that a payer has spent by subtracting all the transactions that are greater than the current timestamp,and record the minimum value for each payer.
//3. All the objects inside the payableBalance database have positive points value, discard the negative points value objects.
app.get('/updatePayableBalance', async (req, res) => {
	//get all transactions with from the database and sort by timestamp ascending

	const transactions = await TransactionModel.find().sort({ timestamp: 1 });
	//first we iterate all transactions in the transactions model, we initialize a new payableBalance model with timestamp = transaction's timestamp, and payer = transaction's payer, and payableBalance = 0.
	for (let i = 0; i < transactions.length; i++) {
		const payableBalance = new payableBalanceModel({
			timestamp: transactions[i].timestamp,
			payer: transactions[i].payer,
			payableBalance: 0,
		});
		//if same object already in the payableBalance database, we skip the operation

		if (
			await payableBalanceModel.findOne({
				timestamp: transactions[i].timestamp,
				payer: transactions[i].payer,
			})
		) {
			continue;
		} else {
			//get the payer from the current transaction
			const payer = transactions[i].payer;
			//initial the minimum value for the payer
			let minValue = transactions[i].points;

			for (let j = i + 1; j < transactions.length; j++) {
				let totalValue = transactions[i].points;
				//if the payer is the same, add or minus the points value to update the minimum value
				if (transactions[j].payer === payer) {
					totalValue += transactions[j].points;
					minValue = Math.min(minValue, totalValue);
				}
			}
			await payableBalanceModel.updateOne(
				{ payer: payer, timestamp: transactions[i].timestamp },
				{ $set: { payableBalance: minValue } }
			);
		}

		await payableBalance.save();
	}

	//delete all the objects with negative points value or zero points value.
	await payableBalanceModel.deleteMany({ payableBalance: { $lte: 0 } });

	//get all payableBalance objects from the database and sort by timestamp ascending
	const payableBalance = await payableBalanceModel.find().sort({
		timestamp: 1,
	});

	//send the payableBalance objects to the client
	res.send(payableBalance);
});

//Setup add transaction route, including payer, points, and timestamp, save all transactions to mongodb

// { "payer": "DANNON", "points": 1000, "timestamp": "2020-11-02T14:00:00Z" }
// { "payer": "UNILEVER", "points": 200, "timestamp": "2020-10-31T11:00:00Z" }
// { "payer": "DANNON", "points": -200, "timestamp": "2020-10-31T15:00:00Z" }
// { "payer": "MILLER COORS", "points": 10000, "timestamp": "2020-11-01T14:00:00Z" }
// { "payer": "DANNON", "points": 300, "timestamp": "2020-10-31T10:00:00Z" }
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
			res.end(
				`I'm sorry, you don't have enough points to spend. You have ${totalPayableBalance} points.`
			);
		} else {
			//while the totalPoints is greater or equal to 0, keep updating each payer's points after deduction. Remember how much points each payer spent from the payableBalance model before the totalPoints reaches 0. We need to return the payer and the points spent as an response after the totalPoints reaches 0. Also we need to update the transaction model after each payer's points spent.

			//initial a new array of json objects to store the payer and the points spent.
			let i = 0;
			while (i < payableBalance.length) {
				//get the payer and the points spent from the payableBalance model
				let payer = payableBalance[i].payer;
				let availablePoints = payableBalance[i].payableBalance;

				//if the availablePoints is greater than the totalPoints, we need to deduct the totalPoints from the availablePoints, and set the availablePoints to 0.

				if (availablePoints > totalPoints) {
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
					payableBalance[i].use = true;
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
