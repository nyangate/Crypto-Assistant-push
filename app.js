var express = require('express')
var app = express()
var admin = require("firebase-admin");
var cserviceAccount = require("./crypto-assistant.json");
var bodyparser = require('body-parser');
var morgan =require('morgan');
var dateFormat = require('dateformat');
var schedule = require('node-schedule');
var request = require('request');
var redis = require("redis");
var moment = require('moment');
app.use(morgan('dev'));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded());

admin.initializeApp({
  credential: admin.credential.cert(cserviceAccount),
  databaseURL: "https://crypto-assistant.firebaseio.com/"
});
var client = redis.createClient({
    retry_strategy: function (options) {
        if (options.error && options.error.code === 'ECONNREFUSED') {
            // End reconnecting on a specific error and flush all commands with a individual error
            return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            // End reconnecting after a specific timeout and flush all commands with a individual error
            return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
            // End reconnecting with built in error
            return undefined;
        }
        // reconnect after
        return Math.min(options.attempt * 100, 3000);
    }
});
client.on("error", function (err) {
    console.log("Error " + err);
});

var defaultAuth = admin.auth();
var customerdb = admin.database();
var usersRef = customerdb.ref("users");
fetchUpdates();




function sendAlert(order,priceChange,increase,limit){
  var key = ("messages/"+order.id+"_"+limit+"_"+increase);
  client.get(key, function(err, reply) {
    if(reply){
          console.log("Message has already been sent");

      }else{
      var payload = {

        data: {
            orderId: order.id,
            title: "Bitcoin price: $"+priceChange,
            body: increase?"Click to find out why price is increasing":"Click to find out why price is decreasing"
          }
        };
          admin.messaging().sendToDevice(order.token, payload)
            .then(function(response) {
              // See the MessagingDevicesResponse reference documentation for
              // the contents of response.

              console.log("Successfully sent message:", response);
              client.set(key,priceChange)
              // var expiryDate = new LocalDate().plusHours(1);
              var expiryDate = moment().add(300, 'minutes').toDate();
              console.log(expiryDate);
              client.expireat(key, parseInt(expiryDate/1000));
            })
            .catch(function(error) {
              console.log("Error sending message:", error);
            });
          }


  });


    }
function getUsers(priceChange){
  usersRef.orderByValue().once("value", function(snapshot) {
  snapshot.forEach(function(data) {
    var greaterthan = JSON.parse(data.val()).greaterThan;
    var lessthan = JSON.parse(data.val()).lessThan;
    if(greaterthan>0 && priceChange>=greaterthan){
      sendAlert(JSON.parse(data.val()),priceChange,true,greaterthan);
    }
    if(lessthan>0 && priceChange<lessthan){
      sendAlert(JSON.parse(data.val()),priceChange,false,lessthan);
    }
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
      console.log("USD/BTC now at: "+JSON.parse(body).USD.buy);
      getUsers(JSON.parse(body).USD.buy);

    });
  }, 1800000);

}


app.listen(8020, function () {
  console.log('app is listening on port 8020')
})
