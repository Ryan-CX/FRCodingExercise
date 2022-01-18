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
















