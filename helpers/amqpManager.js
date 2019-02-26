/**
 * Author: Jonathan Lincoln Brilhante
 * Email: jonathan.lincoln.brilhante@gmail.com
 *
 * Author: Wesnydy Lima Ribeiro
 * Email: wesnydy@lavid.ufpb.br
 */

'use strict';

/**
 * Required libs.
 */
var amqplib = require('amqplib/callback_api');
var rabbit = process.env.RABBIT;
/**
 * Function to send text to the queue.
 */
exports.sendToQueue = function(body, id, queue, durability, res, next) {

  //amqplib.connect('amqp://rabbit', function(err, conn) {
  amqplib.connect('amqp://'+rabbit, function(err, conn) {
    if (err)
      return next(err, 'Cannot connect to RabbitMQ');

    conn.createChannel(function(err, ch) {
      if (err)
        return next(err, 'Channel creation failed.');

      ch.assertQueue(queue, {durable : durability});
      ch.sendToQueue(queue, new Buffer(body), {correlationId : id});
      next(null, 'Message successfully sent');

      try {
        ch.close();
      }
      catch (alreadyClosed) {
        console.log(alreadyClosed.stackAtStateChange);
      }
    });
    setTimeout(function() { conn.close(); }, 500000);
  });
};

/**
 * Function to receive gloss from the queue.
 */
exports.receiveFromQueue = function(id, queue, durability, res, next) {

  amqplib.connect('amqp://'+rabbit, function(err, conn) {
    if (err)
      return next(err, 'Cannot connect to RabbitMQ');

    conn.createChannel(function(err, ch) {
      if (err)
        return next(err, 'Channel creation failed.');

      ch.assertQueue(queue, {durable : durability});
      ch.consume(queue, function(msg) {
        if (msg.properties.correlationId === id) {
          ch.ack(msg);
          next(null, msg.content.toString());
          try {
            ch.close();
          }
          catch (alreadyClosed) {
            console.log(alreadyClosed.stackAtStateChange);
          }
        }
        else {
          ch.reject(msg);
        }
      }, {noAck : false});
    });
    setTimeout(function() { conn.close(); }, 500000);
  });
};
