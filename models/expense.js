const mongoose=require("mongoose");
const Schema=mongoose.Schema;
const explisting=new Schema({
    owner:{
    type:Schema.Types.ObjectId,
    ref:"User"
},
    title:{
        type:String,
        required:true,
    },
    amount:{
        type:Number,
        required:true,
    },
    category:{
        type:String,
        required:true,
    },   Date:{
        type:Date,
        required:true,
    },
    note:String,
  createdAt:{
   type:Date,
   default:Date.now
},
    paymentMethod:{
   type:String,
   enum:["Cash","UPI","Card"],
},
isRecurring:{
   type:Boolean,
   default:false,
},
tags:[String],
currency:{
   type:String,
   default:"INR",
},
});
const Expense = mongoose.model(
    "List",
    explisting
);

module.exports = Expense;