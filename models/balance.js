//create mongoose balance schema with payer as string, points as integer

const mongoose = require('mongoose');
const itemSchema = new mongoose.Schema({
	payer: {
		type: String,
		required: true,
	},
	points: {
		type: Number,
		required: true,
	},
});

const Balance = mongoose.model('Balance', itemSchema);
module.exports = Balance;
