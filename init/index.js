const mongoose=require("mongoose");
const indata=require("./data.js");
const expense=require("../models/expense.js");
const Mongourl="mongodb://127.0.0.1:27017/tracking";
async function main(){
    await mongoose.connect(Mongourl);
}
main().then((res)=>{
   console.log("connected DB");
}).catch((err)=>{
    console.log(err);
});
const initDB=async()=>{
   await expense.deleteMany({});
   await expense.insertMany(indata.data);
   console.log("data is init");
}
initDB();