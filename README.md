# FRCodingExercise


This is a web service exercise that accepts HTTP requests and returns responses based on the conditions.

# Setup
I'm using JS as the language and the app is running in Node.
Package installed: Express, Nodemon.
Although database is not necessary, for this exercise I'm using MongoDB as the database. 
For the purpose of testing I put the MongoDB connection URL inside the main JS file .
To run the app simply use `npm i` to install the dependencies and then `nodemon index.js` to run the app.

For HTTP request operations I'm using Postman.



## Create the database model.
There are 2 models that I created.  

The first one is **transaction** model, which setup the structure of every transaction. As per the instruction, each transaction record contains: ​payer​ (string), ​points​ (integer), ​timestamp​ (date). Thus, my model contains the same properties.

The  second model I create is **payableBalance** Model, which has ​payer​ (string), ​payableBalance​ (integer), ​timestamp​ (date). The timestamp uses the same time as in the transaction model. 

Since we are spending the points from the earliest timestamp, **The purpose of this model is to display when the future transaction happens, starting from the earliest timestamp, how many points that payer can spend.**


## Example Analysis
Suppose you call your add transaction route with the following sequence of calls
after I sorted them by timestamp **ascending**:
 ●  { "payer": "DANNON", "points": 300, "timestamp": "2020-10-31T10:00:00Z" }
 ●  { "payer": "UNILEVER", "points": 200, "timestamp": "2020-10-31T11:00:00Z" }  
●  { "payer": "DANNON", "points": -200, "timestamp": "2020-10-31T15:00:00Z" }  
●  { "payer": "MILLER COORS", "points": 10000, "timestamp": "2020-11-01T14:00:00Z" }  
●  { "payer": "DANNON", "points": 1000, "timestamp": "2020-11-02T14:00:00Z" }  

Then you call your spend points route with the following request:  
{ "points": 5000 }  
The expected response from the spend call would be:  
 This is the detail breakdown of how we split 5k points over these payers:
[  
{ "payer": "DANNON", "points": -100 },  
{ "payer": "UNILEVER", "points": -200 },  
{ "payer": "MILLER COORS", "points": -4,700 }  
]


**Although as per the 1st transaction DANNON has 300 points, but we can not spend it all since later that day we spent another 200 from it which brought it down to 100. That's why for the 5000 points we spent we only took 100 points from DANNON.**


## Some Thoughts

When writing the logic for updating the payableBalance, there are few thing that I am considering:
1. For the first time the payableBalance database is empty so we need to loop the transaction history first. When we checking the transaction history we only care about the positive value since that's the point we "got", we can only find out how much points we can spend when we have positive points.

2. After we spend some points, at certain timestamp the payableBalance will be updated and if it reaches 0, the next time we spending points we bypass that timestamp and check the next one.
3. The checkBalance route returns an object containing all the points from each payer, so it will updates when payableBalance changes.
4. When we update the payableBalance, we have few scenarios to consider: 
	>Same payer with + and - points in short time frame. In this situation we consider the client spent some of the points so we need to calculate the remaining points as available.
	
	>Same payer with + points but in different timestamp. We consider this as a new transaction and add it into the payableBalance database.

	>Different payer different time. We consider this as the new transaction as well.





## Creating HTTP routes

1. app.get('/')
	This is to get all the transaction history based on the timestamp.

2. app.get('/updatePayableBalance')
    This is to get the latest spendable points for each timestamp.
3. app.post('/addTransaction')
    This is to add transaction into the transaction database. For example, the format is:
    { "payer": "DANNON", "points": 1000, "timestamp": "2020-11-02T14:00:00Z" }
4. app.post('/spendPoints')
	This is to sent a request in the format of {"points": number} to spend points.
5. app.get('/balance')
	This is to get the latest balance for each payer.



## Sample Response	

1. app.get('/')
will get the existing transaction in the database based on the timestamp, oldest first.
`[
{"_id":"61e70c63e1acd1509dd545cd","payer":"DANNON","points":300,"timestamp":"2020-10-31T10:00:00.000Z","__v":0},  {"_id":"61e70c4ae1acd1509dd545c4","payer":"UNILEVER","points":200,"timestamp":"2020-10-31T11:00:00.000Z","__v":0},{"_id":"61e70c57e1acd1509dd545c7","payer":"DANNON","points":-200,"timestamp":"2020-10-31T15:00:00.000Z","__v":0},
{"_id":"61e70c5fe1acd1509dd545ca","payer":"MILLER COORS","points":10000,"timestamp":"2020-11-01T14:00:00.000Z","__v":0},{"_id":"61e70c45e1acd1509dd545c1","payer":"DANNON","points":1000,"timestamp":"2020-11-02T14:00:00.000Z","__v":0}
]`

2. app.get('/updatePayableBalance')
Will return how much points available sorted by timestamp.
`[
{"_id":"61e9774a0dd001b414b09362","timestamp":"2020-10-31T10:00:00.000Z","payer":"DANNON","payableBalance":100,"__v":0},
{"_id":"61e9774a0dd001b414b09360","timestamp":"2020-10-31T11:00:00.000Z","payer":"UNILEVER","payableBalance":200,"__v":0},	  	{"_id":"61e9774a0dd001b414b09364","timestamp":"2020-11-01T14:00:00.000Z","payer":"MILLER COORS","payableBalance":10000,"__v":0},
{"_id":"61e9774a0dd001b414b09366","timestamp":"2020-11-02T14:00:00.000Z","payer":"DANNON","payableBalance":1000,"__v":0}
]`


3. app.post('/addTransaction')
Will add a single transaction to the databse, for example:
`{  "payer":  "DANNON",  "points":  300,  "timestamp":  "2020-10-31T10:00:00Z"  }`
If this is the first time adding, will return 200 OK and saved in the database, else will return "Transaction already existed".


4. app.post('/spendPoints')
This is to sent a request in the format of {"points": number} to spend points.
`{  "points":  5000  }`

If current points are less than the spend points, will return "not enough balance", else return the detail of the spending. 
`[  
{ "payer": "DANNON", "points": -100 },  
{ "payer": "UNILEVER", "points": -200 },  
{ "payer": "MILLER COORS", "points": -4,700 }  
]`

5. app.get('/balance')
Will return balance from each payer:
For example, before any spending based on the above starting points will return:
`{"UNILEVER":200,"DANNON":1100,"MILLER COORS":10000}`













