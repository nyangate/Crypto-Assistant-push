var express = require('express')
var app = express()
var admin = require("firebase-admin");
var cserviceAccount = require("./crypto-assistant-firebase-adminsdk.json");
var bodyparser = require('body-parser');
var morgan =require('morgan');
var dateFormat = require('dateformat');
var schedule = require('node-schedule');
var request = require('request');
app.use(morgan('dev'));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded());

admin.initializeApp({
  credential: admin.credential.cert(cserviceAccount),
  databaseURL: "https://crypto-assistant.firebaseio.com/"
});

var defaultAuth = admin.auth();
var customerdb = admin.database();
var customerootRef = customerdb.ref();
var usersRef = customerdb.ref("users");





function sendAlert(order,priceChange,increase){
      var payload = {

        data: {
            orderId: order.id,
            title: "Bitcoin price is now $"+priceChange,
            body: increase?"Click to find out why price is increasing":"Click to find out why price is decreasing"
          }
        };
          admin.messaging().sendToDevice(order.token, payload)
            .then(function(response) {
              // See the MessagingDevicesResponse reference documentation for
              // the contents of response.

              console.log("Successfully sent message:", response);
            })
            .catch(function(error) {
              console.log("Error sending message:", error);
            });

    }
function getUsers(priceChange){
  usersRef.orderByValue().on("value", function(snapshot) {
  snapshot.forEach(function(data) {
    var greaterthan = JSON.parse(data.val()).greaterThan;
    var lessthan = JSON.parse(data.val()).lessThan;
    console.log("The user id " + data.key + "  has greater than " + greaterthan+" and less than "+lessthan);
    if(priceChange>=greaterthan){
      sendAlert(JSON.parse(data.val()),priceChange,true);
    }
    if(priceChange<lessthan){
      sendAlert(JSON.parse(data.val()),priceChange,false);
    }
  });
  });


}
function scheduleOrder(order){
    try{
      var date = new Date(Date.parse(order.scheduled));
        console.log("scheduling order at "+date);
        var j = schedule.scheduleJob(date, function(){
            console.log('Scheduled order is being executed now');
            alertDrivers(order);
          });
    }catch(e){
      console.log(e);
      alertDrivers(order);
    }

}

function rejectOrder(key){

  var query = drootRef.child("orders");
  query.child(key).once("value",function(snap){
    if(snap.val()){
        console.log("rebroadcasting "+key);
      var childData = snap.val();
      var order = JSON.parse(childData);
        deliveriesRef.child(key).set(childData);
        alertDrivers(order);
    }



  });


}

function listenToDriverResponses(){
  var dquery = pickedOrdersRef.orderByKey();
  dquery.on("child_added", function(childSnapshot, prevChildKey) {
    var key = childSnapshot.key;
    console.log(key+ " has been picked");
    deliveriesRef.child(key).remove();
    pickedOrdersRef.child(key).remove();
    console.log("sending picked alert to customer");
    alertCustomer(key);

    trackOrder(key);
  });

}

function trackOrder(key){
  drootRef.child("orders").child(key).on("value",function(snap){
    if(!snap.val())
    return;
    var childData = snap.val();
    var order = JSON.parse(childData);
    console.log(key+ " order "+key+" is at "+order.driverlocation);

      customerootRef.child("ontrack").child(order.orderId).child("driverlocation").set(""+order.driverlocation);
      customerootRef.child("ontrack").child(order.orderId).child("driverphone").set(order.driverphone);
      customerootRef.child("ontrack").child(order.orderId).child("maplocation").set(""+order.maplocation);
      customerootRef.child("ontrack").child(order.orderId).child("driverid").set(order.driverid);
      customerootRef.child("ontrack").child(order.orderId).child("orderId").set(order.orderId);
      customerootRef.child("ontrack").child(order.orderId).child("status").set(order.status);
      customerootRef.child("ontrack").child(order.orderId).child("location").set(order.location);
      if(order.delivered)
      customerootRef.child("ontrack").child(order.orderId).child("delivered").set(order.delivered);

  },function (errorObject) {
    console.log("The read failed: " + errorObject.code);
  });
}

function alertCustomer(key){
  drootRef.child("orders").child(key).once("value",function(snap){
    var childData = snap.val();
    var order = JSON.parse(childData);
    var payload = {

      data: {
        orderId: order.orderId,
        location: order.location,
        title: "Driver Response alert",
        body: "A driver has responded to pick your order. You can track your order now!",
        phone: order.phone
      }
    };
    admin.messaging().sendToDevice(order.token, payload)
      .then(function(response) {
        // See the MessagingDevicesResponse reference documentation for
        // the contents of response.

        console.log("Successfully sent message:", response);
      })
      .catch(function(error) {
        console.log("Error sending message:", error);
      });
  });
}
function fetchUpdates(){
  setInterval(function() {
    request.get("https://blockchain.info/ticker",
    function(err,httpResponse,body){
      if(err){
        console.log(err);
        return;
         }
      //console.log(body);
      getUsers(4117);

    });
  }, 5000);

}
fetchUpdates();

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
