var redis = require('redis')
  ;


/**
 * Create a new NodeRedisPubsub instance that can subscribe to channels and publish messages
 * @param {Object} options Options for the client creations:
 *                 port - Optional, the port on which the Redis server is launched.
 *                 scope - Optional, two NodeRedisPubsubs with different scopes will not share messages
 */
function NodeRedisPubsub (options) {
  options = options || {};
  var port = options && options.port || 6379;   // 6379 is Redis' default
  var host = options && options.host || '127.0.0.1';
  var auth = options && options.auth;

  //use this to store state of 'on' handlers that have already been assigned
  this.handlerAssigned = {};
  
  // Need to create two Redis clients as one cannot be both in receiver and emitter mode
  // I wonder why that is, by the way ...
  this.emitter = redis.createClient(port, host);
  this.receiver = redis.createClient(port, host);

  if (auth) {
      this.emitter.auth(auth)
      this.receiver.auth(auth)
  }

  this.receiver.setMaxListeners(0);

  this.prefix = options.scope ? options.scope + ':' : '';
}
/**
 * Return the emitter object to be used as a regular redis client to save resources.
 */
NodeRedisPubsub.prototype.getRedisClient = function() {
  
  return this.emitter;
}



/**
 * Subscribe to a channel
 * @param {String} channel The channel to subscribe to, can be a pattern e.g. 'user.*'
 * @param {Function} handler Function to call with the received message.
 * @param {Function} cb Optional callback to call once the handler is registered.
 *
 */

NodeRedisPubsub.prototype.on = function(channel, handler, cb) {
  var callback = cb || function () {}
    , self = this;

  //only want to assign the callback once
  //otherwise get duplicate events being fired
  if(! this.handlerAssigned[channel]){
    this.receiver.on('pmessage', function (pattern, _channel, message) {
      if (self.prefix + channel === pattern) {
        handler(JSON.parse(message));
      }
    });
  }
  //this handler has now been assigned
  this.handlerAssigned[channel] = true;
  
  //we can subscribe as many times as we want though
  this.receiver.psubscribe(this.prefix + channel, callback);
};

/**
 * Unsubscribe to a channel
 * @param {String} channel The channel to unsubscribe to, can be a pattern e.g. 'user.*'
 *
 */
NodeRedisPubsub.prototype.unsubscribe = function(channel) {
 //dont think you need to do anything else here
 //as the handler will only be assigned once
 this.receiver.punsubscribe(this.prefix + channel);
};

/**
 * Emit an event
 * @param {String} channel Channel on which to emit the message
 * @param {Object} message
 */
NodeRedisPubsub.prototype.emit = function (channel, message) {
  this.emitter.publish(this.prefix + channel, JSON.stringify(message));
};


module.exports = NodeRedisPubsub;
