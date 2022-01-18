//setup the express app
const express = require('express');
const app = express();
const DB_CONNECTION =
	'mongodb+srv://xcg:wrn2dyhh@notebook.h028d.mongodb.net/reward?retryWrites=true&w=majority';
const mongoose = require('mongoose');
const TransactionModel = require('./models/transaction');
app.use(express.json());
const addTransactions = require('./routes/addTransactions');
const balance = require('./routes/balance');
const payableBalance = require('./routes/payableBalance');
const spendPoints = require('./routes/spendPoints');

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

//The routes
app.use('/addTransactions', addTransactions);
app.use('/payableBalance', payableBalance);
app.use('/spendPoints', spendPoints);
app.use('/balance', balance);

//setup the listen port
app.listen(3000, () => {
	console.log(`listening on port 3000`);
});
