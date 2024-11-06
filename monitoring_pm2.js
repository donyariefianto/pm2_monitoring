const pm2 = require('pm2');
const mqtt = require('mqtt');
const fs = require('fs');
const moment = require('moment/moment');
let last_logs = null
let client = mqtt.connect({
    protocol: 'wss',
    hostname: 'mqtt.enygma.id', // Replace with your broker's IP if not local
    port: 9001,            // WebSocket port of your MQTT broker
    username: '3ny9m4', // Replace with your actual username
    password: '3ny9m4.iop2023', // Replace with your actual password
    path: '/'
}); 

function connectToBroker(client) {
    return new Promise((resolve, reject) => {
    resolve(client.once('connect', () => {
        client.subscribe('enygma_server', (err) => {
            if (!err) {
                console.log('Subscribed to enygma_server');
            }
        });
        console.log('Connected to MQTT broker');
        // client.publish("enygma_server", "message");
    }))
      client.once('error', (error) => {
        log('Connection error: ' + error);
        reject(error);
      });
    });
}

// Function to publish a message to a topic
function publishMessage(topic, message) {
    client.publish(topic, message)
}

async function main () {
  await connectToBroker(client); // Connect only once
  
  pm2.connect(function(error,data) {
    if (error) {
      process.exit(2)
    }
    
    pm2.launchBus(function(err, bus) {
      if (err) {
        process.exit(2)
      }
      // console.log('connected', bus);
      // bus.on('process:exception', function(data) {
      //   console.log(data);
      // });
      bus.on('log:err', async function(data) {
        // pm2.stop(data.process.pm_id)
        let error_messages = data.data
        let detail_process = data.process
        let mes_obj = {
            id_pm2:detail_process.pm_id,
            times:moment().unix(),
            name:detail_process.name,
            server:getCredential().server,
            detail:error_messages
        }
        if (!last_logs) {
            publishMessage("enygma_server", JSON.stringify(mes_obj))
            last_logs = mes_obj
        }else{
            let time_mes_obj = moment.unix(mes_obj.times)
            let time_last_logs = moment.unix(last_logs.times)
            let diff_time = time_mes_obj.diff(time_last_logs,'minutes',true)
            // jika data terahir lebih dari 7 menit maka akan mengirim lagi
            if (diff_time>=7) {
                let check_pm2id_dan_detailnya = (last_logs.detail == mes_obj.detail)&&(Number(last_logs.id_pm2)==Number(mes_obj.id_pm2))
                // jika true maka masih sama jadi tidak perlu kirim lagi
                if (!check_pm2id_dan_detailnya) {
                    publishMessage("enygma_server", JSON.stringify(mes_obj) )
                }
            }

        }
      });
    
      // bus.on('reconnect attempt', function() {
      //   console.log('Bus reconnecting');
      // });
    
      bus.on('close', function() {
        console.log('Bus closed');
        return pm2.disconnect()
      });
    });
  })
//   publishMessage('enygma_serverr', 'Hello from MQTT over WebSocket')
}

function getCredential() {
    let users = fs.readFileSync(".credential",{encoding:'utf8'})
    users = JSON.parse(users)
    return users
}

main()