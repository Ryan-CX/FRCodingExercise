//setup data model schema mongodb

const mongoose = require('mongoose');
//create schema with payer as string, points as integer, and timestamp as isodate
const itemSchema = new mongoose.Schema({
	timestamp: {
		type: Date,

		required: true,
	},
	payer: {
		type: String,
		required: true,
	},
	payableBalance: {
		type: Number,
		required: true,
	},
	used: {
		type: Boolean,
		default: false,
		required: true,
	},
});

const PayableBalance = mongoose.model('PayableBalance', itemSchema);
module.exports = PayableBalance;
