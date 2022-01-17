//setup data model schema mongodb

const mongoose = require('mongoose');
//create schema with payer as string, points as integer, and timestamp as isodate
const itemSchema = new mongoose.Schema({
	payer: {
		type: String,
		required: true,
	},
	points: {
		type: Number,
		required: true,
	},
	timestamp: {
		type: Date,
		default: Date.now,
		required: true,
	},
});

const Transaction = mongoose.model('Transaction', itemSchema);
module.exports = Transaction;
