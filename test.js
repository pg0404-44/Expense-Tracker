const mongoose = require("mongoose");

mongoose.connect(
"mongodb://expenseadmin:Praniti123@ac-fhu4iti-shard-00-00.ool83bg.mongodb.net:27017,ac-fhu4iti-shard-00-01.ool83bg.mongodb.net:27017,ac-fhu4iti-shard-00-02.ool83bg.mongodb.net:27017/?ssl=true&replicaSet=atlas-m8pxa3-shard-0&authSource=admin&appName=Cluster0"
)
.then(() => {
  console.log("Connected!");
  process.exit(0);
})
.catch((err) => {
  console.error(err);
  process.exit(1);
});